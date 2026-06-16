// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SavingsVaults} from "../src/SavingsVaults.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract SavingsVaultsTest is Test {
    SavingsVaults vaults;
    MockERC20 token;

    address owner = makeAddr("owner");
    address ana = makeAddr("ana"); // a keyholder (the "friend")
    address luis = makeAddr("luis");

    uint256 constant START = 1000e18;
    uint256 constant GOAL = 100e18;
    uint64 deadline;

    function setUp() public {
        token = new MockERC20();
        vaults = new SavingsVaults(IERC20(address(token)));
        deadline = uint64(block.timestamp + 30 days);
        token.mint(owner, START);
        vm.prank(owner);
        token.approve(address(vaults), type(uint256).max);
    }

    function _keyholders() internal view returns (address[] memory ks) {
        ks = new address[](1);
        ks[0] = ana;
    }

    function _create() internal returns (uint256 id) {
        vm.prank(owner);
        id = vaults.createVault(GOAL, deadline, _keyholders());
    }

    function _deposit(uint256 id, uint256 amount) internal {
        vm.prank(owner);
        vaults.deposit(id, amount);
    }

    // --- unlock paths (the three the friend-free dev panel exercises) ---

    function test_GoalUnlock() public {
        uint256 id = _create();
        _deposit(id, GOAL);
        assertTrue(vaults.unlocked(id));
        vm.prank(owner);
        vaults.withdraw(id);
        assertEq(token.balanceOf(owner), START); // got it all back
        assertTrue(vaults.getVault(id).closed);
    }

    function test_DeadlineUnlock() public {
        uint256 id = _create();
        _deposit(id, 50e18);
        assertFalse(vaults.unlocked(id)); // below goal, before deadline, no approval
        vm.warp(deadline);
        assertTrue(vaults.unlocked(id));
        vm.prank(owner);
        vaults.withdraw(id);
        assertEq(token.balanceOf(owner), START);
    }

    function test_KeyholderApprovalUnlock() public {
        uint256 id = _create();
        _deposit(id, 50e18);
        assertFalse(vaults.unlocked(id));
        vm.prank(ana); // the friend approves — fully simulated, no real person needed
        vaults.approveEarlyExit(id);
        assertTrue(vaults.unlocked(id));
        vm.prank(owner);
        vaults.withdraw(id);
        assertEq(token.balanceOf(owner), START);
    }

    // --- guards ---

    function test_RevertWithdrawWhenLocked() public {
        uint256 id = _create();
        _deposit(id, 50e18);
        vm.prank(owner);
        vm.expectRevert(bytes("locked"));
        vaults.withdraw(id);
    }

    function test_RevertDoubleWithdraw() public {
        uint256 id = _create();
        _deposit(id, GOAL);
        vm.prank(owner);
        vaults.withdraw(id);
        vm.prank(owner);
        vm.expectRevert(bytes("closed")); // FINAL-1: enforced, not incidental
        vaults.withdraw(id);
    }

    function test_RevertNonOwnerDeposit() public {
        uint256 id = _create();
        token.mint(ana, 100e18);
        vm.startPrank(ana);
        token.approve(address(vaults), type(uint256).max);
        vm.expectRevert(bytes("not owner"));
        vaults.deposit(id, 10e18);
        vm.stopPrank();
    }

    function test_RevertOwnerAsKeyholder() public {
        address[] memory ks = new address[](1);
        ks[0] = owner;
        vm.prank(owner);
        vm.expectRevert(bytes("owner!=keyholder"));
        vaults.createVault(GOAL, deadline, ks);
    }

    function test_RevertDuplicateKeyholder() public {
        address[] memory ks = new address[](2);
        ks[0] = ana;
        ks[1] = ana;
        vm.prank(owner);
        vm.expectRevert(bytes("dup keyholder"));
        vaults.createVault(GOAL, deadline, ks);
    }

    function test_RevertGoalZero() public {
        vm.prank(owner);
        vm.expectRevert(bytes("goal=0"));
        vaults.createVault(0, deadline, _keyholders());
    }

    function test_RevertDeadlineInPast() public {
        vm.prank(owner);
        vm.expectRevert(bytes("deadline<=now"));
        vaults.createVault(GOAL, uint64(block.timestamp), _keyholders());
    }

    // --- enumeration + idempotent approval ---

    function test_OwnerVaultsIndex() public {
        uint256 id1 = _create();
        uint256 id2 = _create();
        uint256[] memory mine = vaults.getOwnerVaults(owner);
        assertEq(mine.length, 2);
        assertEq(mine[0], id1);
        assertEq(mine[1], id2);
    }

    function test_ApprovalIsIdempotent() public {
        uint256 id = _create();
        vm.startPrank(ana);
        vaults.approveEarlyExit(id);
        vaults.approveEarlyExit(id); // second call is a no-op
        vm.stopPrank();
        assertEq(vaults.getVault(id).approvals, 1);
    }

    // --- funded create (create + deposit in one tx) ---

    function test_CreateWithInitialDeposit() public {
        vm.prank(owner);
        uint256 id = vaults.createVault(GOAL, deadline, _keyholders(), 40e18);
        SavingsVaults.Vault memory v = vaults.getVault(id);
        assertEq(v.owner, owner);
        assertEq(v.saved, 40e18); // funded atomically
        assertEq(token.balanceOf(address(vaults)), 40e18);
        assertEq(token.balanceOf(owner), START - 40e18);
        assertFalse(vaults.unlocked(id)); // below goal
    }

    function test_CreateWithDepositReachingGoalUnlocks() public {
        vm.prank(owner);
        uint256 id = vaults.createVault(GOAL, deadline, _keyholders(), GOAL);
        assertEq(vaults.getVault(id).saved, GOAL);
        assertTrue(vaults.unlocked(id)); // goal met at creation
        vm.prank(owner);
        vaults.withdraw(id);
        assertEq(token.balanceOf(owner), START); // round-trips
        assertTrue(vaults.getVault(id).closed);
    }

    function test_CreateWithZeroInitialDepositIsUnfunded() public {
        vm.prank(owner);
        uint256 id = vaults.createVault(GOAL, deadline, _keyholders(), 0);
        assertEq(vaults.getVault(id).saved, 0);
        assertEq(token.balanceOf(address(vaults)), 0);
    }

    function test_CreateWithDepositRequiresApproval() public {
        address poor = makeAddr("poor");
        token.mint(poor, 50e18); // has tokens but has NOT approved the vault
        vm.prank(poor);
        vm.expectRevert(); // SafeERC20: transferFrom without allowance
        vaults.createVault(GOAL, deadline, _keyholders(), 40e18);
    }
}
