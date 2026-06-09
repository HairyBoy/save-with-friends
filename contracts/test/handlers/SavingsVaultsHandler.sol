// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SavingsVaults} from "../../src/SavingsVaults.sol";
import {FeeOnTransferERC20} from "../mocks/FeeOnTransferERC20.sol";

/// Drives random create/deposit/approve/withdraw/warp/donate sequences from a
/// small set of actors. Keeps a ghost array of created ids (the contract can't
/// iterate its `vaults` mapping, and neither can the invariant) so `Σ saved` is
/// computable.
contract SavingsVaultsHandler is Test {
    SavingsVaults public vaults;
    FeeOnTransferERC20 public token;

    address[] public actors;
    uint256[] public ghostIds;
    mapping(uint256 => address[]) internal idKeyholders;

    constructor(SavingsVaults _vaults, FeeOnTransferERC20 _token) {
        vaults = _vaults;
        token = _token;
        actors.push(makeAddr("a0"));
        actors.push(makeAddr("a1"));
        actors.push(makeAddr("a2"));
        actors.push(makeAddr("a3"));
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[bound(seed, 0, actors.length - 1)];
    }

    function createVault(uint256 ownerSeed, uint256 goal, uint256 deadlineDelta, uint256 khSeed) external {
        address owner = _actor(ownerSeed);
        goal = bound(goal, 1, 1_000_000e18);
        uint64 deadline = uint64(block.timestamp + bound(deadlineDelta, 1, 365 days));

        // 0..2 distinct keyholders, none == owner (so createVault never reverts).
        uint256 n = bound(khSeed, 0, 2);
        address[] memory tmp = new address[](n);
        uint256 c;
        for (uint256 i = 0; i < actors.length && c < n; i++) {
            if (actors[i] == owner) continue;
            tmp[c++] = actors[i];
        }
        address[] memory ks = new address[](c);
        for (uint256 i = 0; i < c; i++) ks[i] = tmp[i];

        vm.prank(owner);
        uint256 id = vaults.createVault(goal, deadline, ks);
        ghostIds.push(id);
        for (uint256 i = 0; i < c; i++) idKeyholders[id].push(ks[i]);
    }

    function deposit(uint256 idSeed, uint256 amount) external {
        if (ghostIds.length == 0) return;
        uint256 id = ghostIds[bound(idSeed, 0, ghostIds.length - 1)];
        SavingsVaults.Vault memory v = vaults.getVault(id);
        if (v.closed) return;
        amount = bound(amount, 1, 100_000e18);
        token.mint(v.owner, amount);
        vm.prank(v.owner);
        token.approve(address(vaults), amount);
        vm.prank(v.owner);
        vaults.deposit(id, amount);
    }

    function approve(uint256 idSeed, uint256 khSeed) external {
        if (ghostIds.length == 0) return;
        uint256 id = ghostIds[bound(idSeed, 0, ghostIds.length - 1)];
        address[] storage ks = idKeyholders[id];
        if (ks.length == 0) return;
        if (vaults.getVault(id).closed) return;
        vm.prank(ks[bound(khSeed, 0, ks.length - 1)]);
        vaults.approveEarlyExit(id);
    }

    function withdraw(uint256 idSeed) external {
        if (ghostIds.length == 0) return;
        uint256 id = ghostIds[bound(idSeed, 0, ghostIds.length - 1)];
        SavingsVaults.Vault memory v = vaults.getVault(id);
        if (v.closed || !vaults.unlocked(id)) return;
        vm.prank(v.owner);
        vaults.withdraw(id);
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 60 days));
    }

    /// Stray force-send into the contract — nobody cooperates, balanceOf jumps.
    /// Proves the invariant survives donations (and that `<=` is the right form).
    function donate(uint256 amount) external {
        amount = bound(amount, 1, 10_000e18);
        token.mint(address(this), amount);
        token.transfer(address(vaults), amount);
    }

    // --- ghost views for the invariant ---
    function sumSaved() external view returns (uint256 total) {
        for (uint256 i = 0; i < ghostIds.length; i++) {
            total += vaults.getVault(ghostIds[i]).saved;
        }
    }
}
