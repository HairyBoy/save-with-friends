// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SharedVaults} from "../src/SharedVaults.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract SharedVaultsTest is Test {
    SharedVaults vaults;
    MockERC20 token;

    address owner = makeAddr("owner");
    address ana = makeAddr("ana");
    address luis = makeAddr("luis");
    address sofia = makeAddr("sofia");
    address stranger = makeAddr("stranger");

    uint256 constant START = 1000e18;
    uint256 constant GOAL = 100e18;
    uint64 deadline;

    function setUp() public {
        token = new MockERC20();
        vaults = new SharedVaults(IERC20(address(token)));
        deadline = uint64(block.timestamp + 30 days);
        address[5] memory who = [owner, ana, luis, sofia, stranger];
        for (uint256 i = 0; i < who.length; i++) {
            token.mint(who[i], START);
            vm.prank(who[i]);
            token.approve(address(vaults), type(uint256).max);
        }
    }

    function _members() internal view returns (address[] memory m) {
        m = new address[](2); // owner is added by the contract → 3 members total
        m[0] = ana;
        m[1] = luis;
    }

    function _create(SharedVaults.Payout payout, uint256 initial) internal returns (uint256 id) {
        vm.prank(owner);
        id = vaults.createVault(GOAL, deadline, payout, _members(), initial);
    }

    function _deposit(uint256 id, address who, uint256 amount) internal {
        vm.prank(who);
        vaults.deposit(id, amount);
    }

    // --- creation ---

    function test_CreateAddsOwnerAsMember() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 0);
        assertEq(vaults.getVault(id).memberCount, 3);
        assertTrue(vaults.isMember(id, owner));
        assertTrue(vaults.isMember(id, ana));
        assertTrue(vaults.isMember(id, luis));
        assertFalse(vaults.isMember(id, stranger));
        assertEq(vaults.getMembers(id).length, 3);
        assertEq(vaults.getMemberVaults(ana)[0], id);
    }

    function test_CreateWithInitialDeposit() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 40e18);
        assertEq(vaults.getVault(id).saved, 40e18);
        assertEq(vaults.contributionOf(id, owner), 40e18);
    }

    function test_CreateRevertsOnBadInput() public {
        vm.startPrank(owner);
        vm.expectRevert("goal=0");
        vaults.createVault(0, deadline, SharedVaults.Payout.BY_CONTRIBUTION, _members(), 0);
        vm.expectRevert("deadline<=now");
        vaults.createVault(GOAL, uint64(block.timestamp), SharedVaults.Payout.BY_CONTRIBUTION, _members(), 0);
        address[] memory none = new address[](0);
        vm.expectRevert("need members");
        vaults.createVault(GOAL, deadline, SharedVaults.Payout.BY_CONTRIBUTION, none, 0);
        vm.stopPrank();
    }

    function test_CreateRevertsOnDuplicateOrOwnerMember() public {
        address[] memory dup = new address[](2);
        dup[0] = ana;
        dup[1] = ana;
        vm.prank(owner);
        vm.expectRevert("dup member");
        vaults.createVault(GOAL, deadline, SharedVaults.Payout.BY_CONTRIBUTION, dup, 0);

        address[] memory withOwner = new address[](1);
        withOwner[0] = owner;
        vm.prank(owner);
        vm.expectRevert("dup member"); // owner already added as member #0
        vaults.createVault(GOAL, deadline, SharedVaults.Payout.BY_CONTRIBUTION, withOwner, 0);
    }

    // --- deposits + unlock paths ---

    function test_MembersDepositOwnFunds() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 0);
        _deposit(id, ana, 30e18);
        _deposit(id, luis, 20e18);
        assertEq(vaults.contributionOf(id, ana), 30e18);
        assertEq(vaults.contributionOf(id, luis), 20e18);
        assertEq(vaults.getVault(id).saved, 50e18);
        assertEq(token.balanceOf(address(vaults)), 50e18);
    }

    function test_StrangerCannotDeposit() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 0);
        vm.prank(stranger);
        vm.expectRevert("not member");
        vaults.deposit(id, 10e18);
    }

    function test_GoalUnlock() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 0);
        _deposit(id, owner, 40e18);
        _deposit(id, ana, 30e18);
        assertFalse(vaults.unlocked(id));
        _deposit(id, luis, 30e18); // crosses goal
        assertTrue(vaults.unlocked(id));
    }

    function test_DeadlineUnlock() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 10e18);
        assertFalse(vaults.unlocked(id));
        vm.warp(deadline);
        assertTrue(vaults.unlocked(id));
    }

    function test_CannotDepositOnceUnlocked() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 10e18);
        vm.warp(deadline); // unlocked by deadline
        vm.prank(ana);
        vm.expectRevert("unlocked");
        vaults.deposit(id, 5e18);
    }

    // --- majority early approval ---

    function test_MajorityApprovalUnlocks() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 10e18); // 3 members
        vm.prank(ana);
        vaults.approveEarlyExit(id);
        assertFalse(vaults.unlocked(id)); // 1 of 3 is not a majority
        vm.prank(luis);
        vaults.approveEarlyExit(id);
        assertTrue(vaults.unlocked(id)); // 2 of 3 is
    }

    function test_ApprovalIsIdempotent() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 10e18);
        vm.startPrank(ana);
        vaults.approveEarlyExit(id);
        vaults.approveEarlyExit(id); // no-op
        vm.stopPrank();
        assertEq(vaults.getVault(id).approvals, 1);
        assertFalse(vaults.unlocked(id));
    }

    function test_EvenMembersNeedStrictMajority() public {
        // owner + ana + luis + sofia = 4 members → majority is 3
        address[] memory four = new address[](3);
        four[0] = ana;
        four[1] = luis;
        four[2] = sofia;
        vm.prank(owner);
        uint256 id = vaults.createVault(GOAL, deadline, SharedVaults.Payout.BY_CONTRIBUTION, four, 10e18);
        vm.prank(ana);
        vaults.approveEarlyExit(id);
        vm.prank(luis);
        vaults.approveEarlyExit(id);
        assertFalse(vaults.unlocked(id)); // 2 of 4 is not strict majority
        vm.prank(sofia);
        vaults.approveEarlyExit(id);
        assertTrue(vaults.unlocked(id)); // 3 of 4 is
    }

    function test_StrangerCannotApprove() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 10e18);
        vm.prank(stranger);
        vm.expectRevert("not member");
        vaults.approveEarlyExit(id);
    }

    // --- withdrawal: by contribution ---

    function test_ByContributionEachWithdrawsOwnShare() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 40e18); // owner 40
        _deposit(id, ana, 30e18);
        _deposit(id, luis, 30e18); // goal met → unlocked
        assertTrue(vaults.unlocked(id));

        vm.prank(ana);
        vaults.withdraw(id);
        vm.prank(luis);
        vaults.withdraw(id);
        vm.prank(owner);
        vaults.withdraw(id);

        assertEq(token.balanceOf(ana), START);
        assertEq(token.balanceOf(luis), START);
        assertEq(token.balanceOf(owner), START);
        assertEq(token.balanceOf(address(vaults)), 0);
        assertTrue(vaults.getVault(id).closed);
    }

    function test_ByContributionNoDoubleWithdraw() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 40e18); // owner 40
        _deposit(id, ana, 60e18); // goal met → unlocked; pot still has owner's 40 after ana withdraws
        vm.prank(ana);
        vaults.withdraw(id); // ana takes her 60 (pot not yet empty → not closed)
        vm.prank(ana);
        vm.expectRevert("amount=0"); // her share is gone
        vaults.withdraw(id);
    }

    function test_CannotWithdrawWhileLocked() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 10e18);
        vm.prank(owner);
        vm.expectRevert("locked");
        vaults.withdraw(id);
    }

    // --- withdrawal: owner takes all (group gift) ---

    function test_OwnerTakesAll() public {
        uint256 id = _create(SharedVaults.Payout.OWNER_TAKES_ALL, 0);
        _deposit(id, ana, 50e18);
        _deposit(id, luis, 50e18); // goal met → unlocked
        assertTrue(vaults.unlocked(id));

        vm.prank(owner);
        vaults.withdraw(id);
        assertEq(token.balanceOf(owner), START + 100e18); // owner got the whole pot
        assertTrue(vaults.getVault(id).closed);
    }

    function test_OwnerTakesAll_NonOwnerCannotWithdraw() public {
        uint256 id = _create(SharedVaults.Payout.OWNER_TAKES_ALL, 0);
        _deposit(id, ana, 50e18);
        _deposit(id, luis, 50e18);
        vm.prank(ana);
        vm.expectRevert("owner only");
        vaults.withdraw(id);
    }

    function test_StrangerCannotWithdraw() public {
        uint256 id = _create(SharedVaults.Payout.BY_CONTRIBUTION, 40e18);
        _deposit(id, ana, 30e18);
        _deposit(id, luis, 30e18);
        vm.prank(stranger);
        vm.expectRevert("not member");
        vaults.withdraw(id);
    }

    // --- fuzz: conservation + exact by-contribution payout ---

    function testFuzz_ConservationAndPayout(uint256 a, uint256 b, uint256 c) public {
        a = bound(a, 1e18, START);
        b = bound(b, 1e18, START);
        c = bound(c, 1e18, START);
        // Huge goal so deposits never auto-unlock; we unlock via the deadline instead.
        vm.prank(owner);
        uint256 id = vaults.createVault(type(uint256).max, deadline, SharedVaults.Payout.BY_CONTRIBUTION, _members(), 0);

        _deposit(id, owner, a);
        _deposit(id, ana, b);
        _deposit(id, luis, c);

        // Conservation: pot == sum of contributions == contract balance.
        uint256 total = a + b + c;
        assertEq(vaults.getVault(id).saved, total);
        assertEq(vaults.contributionOf(id, owner) + vaults.contributionOf(id, ana) + vaults.contributionOf(id, luis), total);
        assertEq(token.balanceOf(address(vaults)), total);

        vm.warp(deadline);
        vm.prank(owner);
        vaults.withdraw(id);
        vm.prank(ana);
        vaults.withdraw(id);
        vm.prank(luis);
        vaults.withdraw(id);

        // Everyone got back exactly what they put in; the contract is empty + closed.
        assertEq(token.balanceOf(owner), START);
        assertEq(token.balanceOf(ana), START);
        assertEq(token.balanceOf(luis), START);
        assertEq(token.balanceOf(address(vaults)), 0);
        assertTrue(vaults.getVault(id).closed);
    }
}
