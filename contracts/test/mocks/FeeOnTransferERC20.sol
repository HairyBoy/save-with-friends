// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// A token that skims a 1% fee on every real transfer — the hostile case the
/// vault's balance-delta accounting must survive. If the contract trusted the
/// passed `amount` instead of the measured delta, `Σ saved` would drift above
/// `balanceOf` and the conservation invariant would break.
contract FeeOnTransferERC20 is ERC20 {
    uint256 public constant FEE_BPS = 100; // 1%
    address public immutable sink;

    constructor(address _sink) ERC20("Fee USD", "fUSD") {
        sink = _sink;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        // Apply the fee only to real transfers (not mint/burn).
        if (from != address(0) && to != address(0) && value > 0) {
            uint256 fee = (value * FEE_BPS) / 10_000;
            super._update(from, sink, fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}
