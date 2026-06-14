// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SavingsVaults} from "../src/SavingsVaults.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice Local-dev deploy. On Anvil there is no real cUSD, so we deploy a mock
/// stablecoin, mint a starting balance to the deployer, then deploy SavingsVaults
/// bound to that token (immutable at deploy). Prints both addresses for lib/chains.ts.
///
/// Run against a running Anvil:
///   forge script script/Deploy.s.sol --rpc-url http://localhost:8545 \
///     --private-key <anvil_key_0> --broadcast
contract Deploy is Script {
    // 1,000,000 mUSD (18 decimals) minted to the deployer for local testing.
    uint256 constant SEED_MINT = 1_000_000 ether;

    function run() external {
        vm.startBroadcast();

        MockERC20 token = new MockERC20();
        token.mint(msg.sender, SEED_MINT);

        SavingsVaults vaults = new SavingsVaults(token);

        vm.stopBroadcast();

        console.log("MockERC20 (cUSD stand-in):", address(token));
        console.log("SavingsVaults:            ", address(vaults));
        console.log("Deployer (minted 1M mUSD):", msg.sender);
    }
}
