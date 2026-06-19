// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice The slice of the Aave V3 `Pool` the yield vaults use. The full ABI is
/// large; we declare only `supply`, `withdraw`, and the income index so the vault
/// has no dependency on Aave's `DataTypes` structs (the aToken is passed in at
/// deploy instead of read from `getReserveData`). On Celo mainnet:
///   POOL = 0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402
interface IAavePool {
    /// Supply `amount` of `asset`, minting aTokens to `onBehalfOf`. The vault must
    /// have approved the Pool for `asset` first.
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;

    /// Withdraw `amount` of `asset` to `to`, burning the caller's aTokens. Returns
    /// the amount actually withdrawn. Pass `type(uint256).max` to withdraw the full
    /// balance — the vaults never do (the position is commingled across vaults).
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);

    /// The reserve's normalized income, a ray (1e27) index that only grows. Current
    /// underlying value of a scaled balance = scaledBalance.rayMul(thisIndex).
    function getReserveNormalizedIncome(address asset) external view returns (uint256);
}

/// @notice The scaled-balance side of an Aave V3 aToken. aTokens rebase (raw
/// `balanceOf` grows with yield), so we account in scaled units, which are
/// rebase-invariant: a deposit's scaled shares stay fixed while their redeemable
/// value grows as the income index rises.
interface IScaledToken {
    /// The caller's balance in scaled (index-divided) units.
    function scaledBalanceOf(address user) external view returns (uint256);
}
