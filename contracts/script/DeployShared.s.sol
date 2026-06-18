// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SharedVaults} from "../src/SharedVaults.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/// @notice Deploys SharedVaults bound to a stablecoin (immutable at deploy), mirroring
/// Deploy.s.sol for the solo contract.
///
/// - If VAULT_TOKEN is set (e.g. USDC on Celo Sepolia: 0x01C5…BC44E), bind to it.
/// - Otherwise (local Anvil) deploy a MockERC20 and seed the deployer.
///
/// Celo Sepolia:
///   VAULT_TOKEN=0x01C5C0122039549AD1493B8220cABEdD739BC44E \
///   forge script script/DeployShared.s.sol \
///     --rpc-url https://forno.celo-sepolia.celo-testnet.org \
///     --private-key $DEPLOYER_PK --broadcast
contract DeployShared is Script {
    uint256 constant SEED_MINT = 1_000_000 ether;

    function run() external {
        address existingToken = vm.envOr("VAULT_TOKEN", address(0));

        vm.startBroadcast();

        address token;
        if (existingToken != address(0)) {
            token = existingToken;
        } else {
            MockERC20 mock = new MockERC20();
            mock.mint(msg.sender, SEED_MINT);
            token = address(mock);
        }

        SharedVaults shared = new SharedVaults(IERC20(token));

        vm.stopBroadcast();

        console.log("Token (vault stablecoin):", token);
        console.log("SharedVaults:            ", address(shared));
        console.log("Deployer:                ", msg.sender);
    }
}
