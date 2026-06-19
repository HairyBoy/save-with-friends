// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {YieldSavingsVaults} from "../src/YieldSavingsVaults.sol";
import {YieldSharedVaults} from "../src/YieldSharedVaults.sol";
import {IAavePool, IScaledToken} from "../src/interfaces/IAaveV3.sol";

/// @notice Deploys the v3 Aave-yield vaults (solo + shared), bound at deploy to a
/// stablecoin, the Aave V3 Pool, and that reserve's aToken — all immutable.
///
/// There is NO Aave on Celo Sepolia, so this targets **Celo mainnet** (defaults below,
/// from bgd-labs/aave-address-book :: AaveV3Celo). Validate first on a mainnet fork:
///   forge test --match-path test/YieldVaults.fork.t.sol -vv
///
/// Then deploy, signing from a keystore (never paste a raw key):
///   forge script script/DeployYield.s.sol \
///     --rpc-url https://forno.celo.org \
///     --account <your-keystore> --broadcast --verify
///
/// Override any address via env (VAULT_TOKEN / AAVE_POOL / AAVE_ATOKEN) if Aave
/// re-points or to deploy on a different chain.
contract DeployYield is Script {
    // Aave V3 Celo mainnet defaults.
    address constant CELO_USDC = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C; // 6 decimals
    address constant CELO_AAVE_POOL = 0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402;
    address constant CELO_AUSDC = 0xFF8309b9e99bfd2D4021bc71a362aBD93dBd4785;

    function run() external {
        address token = vm.envOr("VAULT_TOKEN", CELO_USDC);
        address aavePool = vm.envOr("AAVE_POOL", CELO_AAVE_POOL);
        address aToken = vm.envOr("AAVE_ATOKEN", CELO_AUSDC);

        require(token != address(0) && aavePool != address(0) && aToken != address(0), "missing address");

        vm.startBroadcast();

        YieldSavingsVaults solo = new YieldSavingsVaults(IERC20(token), IAavePool(aavePool), IScaledToken(aToken));
        YieldSharedVaults shared = new YieldSharedVaults(IERC20(token), IAavePool(aavePool), IScaledToken(aToken));

        vm.stopBroadcast();

        console.log("Token (vault stablecoin):", token);
        console.log("Aave Pool:               ", aavePool);
        console.log("aToken:                  ", aToken);
        console.log("YieldSavingsVaults:      ", address(solo));
        console.log("YieldSharedVaults:       ", address(shared));
        console.log("Deployer:                ", msg.sender);
    }
}
