// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract LootCrate is ERC1155, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Token IDs: 1 = “Sword” (max 5000, fungible), 2 = “Shield” (max 5000), 3+ = unique cosmetic NFTs (non-fungible style, max supply 1).
    uint256 public constant MAX_SUPPLY_SWORD = 5000;
    uint256 public constant MAX_SUPPLY_SHIELD = 5000;
    uint256 public constant MAX_SUPPLY_COSMETICS = 1; // Each cosmetic is unique and non-fungible.

    // Track supply of fungible tokens
    mapping(uint256 => uint256) public supply; // Maps token ID to current supply
    mapping(uint256 => uint256) public maxSupply; // Maps token ID to max supply

    // Events
    event BatchMinted(address indexed to, uint256[] tokenIds, uint256[] amounts);

    constructor() ERC1155("ipfs://test...") {
        // Initialize max supply for fungible tokens
        maxSupply[1] = MAX_SUPPLY_SWORD;
        maxSupply[2] = MAX_SUPPLY_SHIELD;
         // No need to set max supply for cosmetics as they are unique and non-fungible
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // Override supportsInterface from ERC1155, and AccessControl
    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // openCrate(uint count) payable mints random mix of IDs 1–3 based on keccak256(msg.sender, block.timestamp). Price: 0.02 ETH each.
    function openCrate(uint count) public payable whenNotPaused {
        require(msg.value == 0.02 ether * count, "Incorrect payment amount");
        require(count > 0, "Count must be greater than 0");
        require(address(this).balance >= 0.02 ether * count, "Insufficient contract balance");

        for (uint i = 0; i < count; i++) {
            uint256 randomValue = uint256(keccak256(abi.encodePacked(msg.sender, block.timestamp, i))) % 100;
            uint256 tokenId;
            if (randomValue < 50) {
                tokenId = 1; // Sword
            } else if (randomValue < 90) {
                tokenId = 2; // Shield
            } else {
                tokenId = 3 + randomValue % 3; // Cosmetic (IDs 3, 4, 5)
            }

            _mint(msg.sender, tokenId, 1, "");
        }
    }

    // mintBatch(address to, uint[] ids, uint[] amounts) – only MINTER_ROLE for airdrops.
    function mintBatch(address to, uint[] memory ids, uint[] memory amounts) public onlyRole(MINTER_ROLE) {
        require(ids.length == amounts.length, "ids and amounts length mismatch");
        _mintBatch(to, ids, amounts, "");
        emit BatchMinted(to, ids, amounts);
    }

    // Pause/Unpause function
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}