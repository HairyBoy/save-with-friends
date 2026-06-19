// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {YieldSavingsVaults} from "../src/YieldSavingsVaults.sol";
import {YieldSharedVaults} from "../src/YieldSharedVaults.sol";
import {IAavePool, IScaledToken} from "../src/interfaces/IAaveV3.sol";

/// @notice Live integration tests against the REAL Aave V3 deployment on Celo
/// mainnet, via a fork. There is no Aave on Celo Sepolia, so a mainnet fork is the
/// only way to exercise the actual supply/withdraw/index path before going live.
///
/// Run (needs a Celo mainnet RPC; the public Forno default works but can rate-limit):
///   forge test --match-path test/YieldVaults.fork.t.sol -vv
///   CELO_RPC=https://<your-rpc> forge test --match-path test/YieldVaults.fork.t.sol -vv
///
/// These are skipped by a plain `forge test` only if you scope it out; otherwise they
/// fork on setUp. Keep them out of the unit/invariant CI lane that has no network.
abstract contract CeloForkBase is Test {
    // Aave V3 Celo mainnet (bgd-labs/aave-address-book :: AaveV3Celo).
    address constant POOL = 0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402;
    address constant USDC = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C; // 6 decimals
    address constant AUSDC = 0xFF8309b9e99bfd2D4021bc71a362aBD93dBd4785;

    IAavePool pool = IAavePool(POOL);
    IERC20 usdc = IERC20(USDC);
    IScaledToken aUsdc = IScaledToken(AUSDC);

    function _fork() internal {
        string memory rpc = vm.envOr("CELO_RPC", string("https://forno.celo.org"));
        vm.createSelectFork(rpc);
    }

    /// Give `who` `amt` USDC. USDC on Celo is a proxy; `deal` brute-forces the slot.
    function _fund(address who, uint256 amt) internal {
        deal(USDC, who, amt);
        assertEq(usdc.balanceOf(who), amt, "deal USDC failed");
    }
}

contract YieldSavingsVaultsForkTest is CeloForkBase {
    YieldSavingsVaults vaults;

    address owner = makeAddr("owner");
    address ana = makeAddr("ana"); // keyholder

    uint256 constant GOAL = 1_000e6; // $1000, 6 decimals
    uint256 constant DEPOSIT = 600e6; // $600, below goal => stays locked

    function setUp() public {
        _fork();
        vaults = new YieldSavingsVaults(usdc, pool, aUsdc);
    }

    function _createFunded(uint256 deposit) internal returns (uint256 id) {
        address[] memory ks = new address[](1);
        ks[0] = ana;
        _fund(owner, deposit);
        vm.startPrank(owner);
        usdc.approve(address(vaults), deposit);
        id = vaults.createVault(GOAL, uint64(block.timestamp + 30 days), ks, deposit);
        vm.stopPrank();
    }

    /// Principal is actually supplied to Aave: the vault holds aUSDC, not USDC.
    function test_depositSuppliesToAave() public {
        uint256 id = _createFunded(DEPOSIT);

        assertEq(usdc.balanceOf(address(vaults)), 0, "USDC should be in Aave, not idle");
        assertGt(aUsdc.scaledBalanceOf(address(vaults)), 0, "no aUSDC minted");
        assertEq(vaults.getVault(id).saved, DEPOSIT, "principal mis-recorded");
        // Withdrawable starts ~= principal (a wei of rounding either way is fine).
        assertApproxEqAbs(vaults.withdrawable(id), DEPOSIT, 2, "initial value != principal");
    }

    /// The headline feature: locked money earns yield, and the saver keeps it.
    function test_yieldAccruesAndOwnerKeepsIt() public {
        uint256 id = _createFunded(DEPOSIT);
        uint256 indexBefore = pool.getReserveNormalizedIncome(USDC);

        vm.warp(block.timestamp + 365 days); // accrue ~a year of supply interest

        uint256 indexAfter = pool.getReserveNormalizedIncome(USDC);
        uint256 value = vaults.withdrawable(id);
        console.log("index before/after:", indexBefore, indexAfter);
        console.log("principal / withdrawable:", DEPOSIT, value);

        // Deadline (30d) has passed => unlocked. Withdraw and check the payout.
        uint256 balBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        vaults.withdraw(id);
        uint256 payout = usdc.balanceOf(owner) - balBefore;

        assertGe(payout, DEPOSIT, "owner must never get back less than principal");
        if (indexAfter > indexBefore) {
            assertGt(payout, DEPOSIT, "index grew but no yield paid out");
            console.log("yield earned (USDC base units):", payout - DEPOSIT);
        }
        assertTrue(vaults.getVault(id).closed, "vault not closed after withdraw");
    }

    /// Conservation across two vaults: withdrawing one fully pays it AND leaves the
    /// other whole — the floor-rounding can't let vault A eat vault B's principal.
    function test_conservationAcrossVaults() public {
        uint256 a = _createFunded(DEPOSIT);
        uint256 b = _createFunded(DEPOSIT);

        // Invariant holds right after deposits.
        uint256 sumScaled = vaults.getVault(a).scaledSaved + vaults.getVault(b).scaledSaved;
        assertLe(sumScaled, aUsdc.scaledBalanceOf(address(vaults)), "conservation broken at rest");

        vm.warp(block.timestamp + 400 days); // unlock both via deadline + accrue

        vm.prank(owner);
        vaults.withdraw(a);

        // Vault B's claim is still fully covered by the contract's remaining position.
        uint256 owedB = vaults.withdrawable(b);
        assertLe(owedB, _underlyingBalance(), "B under-collateralized after A withdrew");

        // And B can in fact withdraw at least its principal.
        uint256 balBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        vaults.withdraw(b);
        assertGe(usdc.balanceOf(owner) - balBefore, DEPOSIT, "B shorted");
    }

    /// Unlock-while-locked is still enforced with funds in Aave.
    function test_lockedCannotWithdraw() public {
        uint256 id = _createFunded(DEPOSIT); // below goal, deadline far off
        vm.prank(owner);
        vm.expectRevert(bytes("locked"));
        vaults.withdraw(id);
    }

    /// Keyholder early-exit path works end-to-end with Aave-backed funds.
    function test_keyholderEarlyExit() public {
        uint256 id = _createFunded(DEPOSIT);
        vm.prank(ana);
        vaults.approveEarlyExit(id);
        assertTrue(vaults.unlocked(id), "approval did not unlock");

        uint256 balBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        vaults.withdraw(id);
        uint256 payout = usdc.balanceOf(owner) - balBefore;
        // Immediate exit with zero elapsed yield floors to principal - at most 1 base
        // unit ($0.000001) — the conservation-safe rounding direction (see contract
        // docs). Any real lock accrues yield that dwarfs this dust.
        assertApproxEqAbs(payout, DEPOSIT, 1, "early-exit payout off by more than dust");
        assertLe(payout, DEPOSIT, "cannot gain yield with no time elapsed");
    }

    function _underlyingBalance() internal view returns (uint256) {
        // Current underlying value of the contract's whole aUSDC position.
        return (aUsdc.scaledBalanceOf(address(vaults)) * pool.getReserveNormalizedIncome(USDC)) / 1e27;
    }
}

contract YieldSharedVaultsForkTest is CeloForkBase {
    YieldSharedVaults shared;

    address owner = makeAddr("owner");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint256 constant GOAL = 10_000e6;
    uint256 constant STAKE = 1_000e6;

    function setUp() public {
        _fork();
        shared = new YieldSharedVaults(usdc, pool, aUsdc);
    }

    function _create(YieldSharedVaults.Payout payout) internal returns (uint256 id) {
        address[] memory members = new address[](2);
        members[0] = bob;
        members[1] = carol;
        _fund(owner, STAKE);
        vm.startPrank(owner);
        usdc.approve(address(shared), STAKE);
        id = shared.createVault(GOAL, uint64(block.timestamp + 30 days), payout, members, STAKE);
        vm.stopPrank();
    }

    function _deposit(uint256 id, address who, uint256 amt) internal {
        _fund(who, amt);
        vm.startPrank(who);
        usdc.approve(address(shared), amt);
        shared.deposit(id, amt);
        vm.stopPrank();
    }

    /// BY_CONTRIBUTION: each member withdraws their own stake plus its yield, and the
    /// pot stays solvent through partial withdrawals.
    function test_byContributionEachKeepsOwnYield() public {
        uint256 id = _create(YieldSharedVaults.Payout.BY_CONTRIBUTION);
        _deposit(id, bob, STAKE);
        _deposit(id, carol, STAKE);

        vm.warp(block.timestamp + 365 days); // unlock via deadline + accrue yield

        // Each member pulls their own; none can short the others.
        _withdrawAndCheck(id, owner);
        _withdrawAndCheck(id, bob);
        _withdrawAndCheck(id, carol);

        assertTrue(shared.getVault(id).closed, "vault not closed after last withdraw");
        assertEq(shared.getVault(id).scaledSaved, 0, "scaled dust left as debt");
    }

    function _withdrawAndCheck(uint256 id, address who) internal {
        uint256 balBefore = usdc.balanceOf(who);
        vm.prank(who);
        shared.withdraw(id);
        assertGe(usdc.balanceOf(who) - balBefore, STAKE, "member got back less than stake");
    }

    /// OWNER_TAKES_ALL: only the owner withdraws, and gets the whole pot + all yield.
    function test_ownerTakesAllPotPlusYield() public {
        uint256 id = _create(YieldSharedVaults.Payout.OWNER_TAKES_ALL);
        _deposit(id, bob, STAKE);
        _deposit(id, carol, STAKE);
        uint256 totalPrincipal = 3 * STAKE;

        vm.warp(block.timestamp + 365 days);

        vm.prank(bob);
        vm.expectRevert(bytes("owner only"));
        shared.withdraw(id);

        uint256 balBefore = usdc.balanceOf(owner);
        vm.prank(owner);
        shared.withdraw(id);
        assertGe(usdc.balanceOf(owner) - balBefore, totalPrincipal, "owner shorted the pot");
    }
}
