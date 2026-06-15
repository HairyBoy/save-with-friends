// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SavingsVaults} from "../src/SavingsVaults.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice Deploys SavingsVaults bound to a stablecoin (immutable at deploy).
///
/// - If the env var VAULT_TOKEN is set to an existing token address (e.g. USDm
///   on Celo Sepolia: 0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80), the vault is
///   bound to it and no mock is deployed.
/// - Otherwise (local Anvil, where there's no real cUSD) a MockERC20 is deployed
///   and 1,000,000 minted to the deployer for testing.
///
/// Local Anvil:
///   forge script script/Deploy.s.sol --rpc-url http://localhost:8545 \
///     --private-key <anvil_key_0> --broadcast
///
/// Celo Sepolia (USDm), signing from a Foundry keystore (never paste a raw key):
///   VAULT_TOKEN=0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80 \
///   forge script script/Deploy.s.sol \
///     --rpc-url https://forno.celo-sepolia.celo-testnet.org \
///     --account <your-keystore> --broadcast
contract Deploy is Script {
    // 1,000,000 mock USD (18 decimals) minted to the deployer for local testing.
    uint256 constant SEED_MINT = 1_000_000 ether;

    function run() external {
        // An existing stablecoin to bind to (testnet/mainnet); address(0) = none.
        address existingToken = vm.envOr("VAULT_TOKEN", address(0));

        vm.startBroadcast();

        address token;
        if (existingToken != address(0)) {
            token = existingToken; // bind to the real stablecoin (e.g. USDm)
        } else {
            MockERC20 mock = new MockERC20();
            mock.mint(msg.sender, SEED_MINT);
            token = address(mock);
        }

        SavingsVaults vaults = new SavingsVaults(IERC20(token));

        vm.stopBroadcast();

        console.log("Token (vault stablecoin):", token);
        console.log("SavingsVaults:           ", address(vaults));
        console.log("Deployer:                ", msg.sender);
    }
}
