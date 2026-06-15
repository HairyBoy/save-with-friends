// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SavingsVaults} from "../src/SavingsVaults.sol";
import {FeeOnTransferERC20} from "./mocks/FeeOnTransferERC20.sol";
import {SavingsVaultsHandler} from "./handlers/SavingsVaultsHandler.sol";

/// Uses a fee-on-transfer token (so balance-delta accounting is actually exercised)
/// and a handler that can also donate stray tokens into the contract.
contract SavingsVaultsInvariant is Test {
    SavingsVaults vaults;
    FeeOnTransferERC20 token;
    SavingsVaultsHandler handler;

    function setUp() public {
        token = new FeeOnTransferERC20(makeAddr("feesink"));
        vaults = new SavingsVaults(IERC20(address(token)));
        handler = new SavingsVaultsHandler(vaults, token);

        // Only fuzz the handler's action functions.
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = SavingsVaultsHandler.createVault.selector;
        selectors[1] = SavingsVaultsHandler.deposit.selector;
        selectors[2] = SavingsVaultsHandler.approve.selector;
        selectors[3] = SavingsVaultsHandler.withdraw.selector;
        selectors[4] = SavingsVaultsHandler.warp.selector;
        selectors[5] = SavingsVaultsHandler.donate.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    /// The contract always holds AT LEAST what it owes. `<=` not `==`: anyone can
    /// force-send tokens in, so balanceOf can exceed Σ saved — but never the reverse.
    function invariant_conservation() public view {
        assertLe(handler.sumSaved(), token.balanceOf(address(vaults)));
    }
}
