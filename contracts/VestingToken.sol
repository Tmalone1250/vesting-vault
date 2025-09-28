// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

// VestingToken is an ERC20 token with burnable functionality
contract VestingToken is ERC20, ERC20Burnable, AccessControl, ERC20Pausable {

    // State Variables
    uint256 public constant TOTAL_SUPPLY = 100000000 * 10 ** 18;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Custom Errors
    error ZeroAddress();

    // Constructor
    constructor(string memory name_, string memory symbol_, address admin) ERC20(name_, symbol_) {
        if (admin == address(0)) revert ZeroAddress();
        _mint(msg.sender, TOTAL_SUPPLY);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    // Mint Function - only accounts with MINTER_ROLE can mint new tokens
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        _mint(to, amount);
    }

    // Burn Functionality is inherited from ERC20Burnable
    function burn(uint256 amount) public override {
        _burn(_msgSender(), amount);
    }

    // Transfer Functionality is inherited from ERC20
    function transfer(address to, uint256 amount) public override returns (bool) {
        return super.transfer(to, amount);
    }

    // Pause Function
    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    // Unpause Function
    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // Override _update from ERC20 and ERC20Pausable
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }
}