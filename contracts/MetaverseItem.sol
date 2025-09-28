// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

// MetaverseItem is an ERC721 token with royalty functionality
contract MetaverseItem is ERC721, ERC721Royalty, ERC721Enumerable, AccessControl {

    // State Variables
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint96 public constant ROYALTY = 500;
    string private _storedBaseURI;

    // Custom Errors
    error ZeroAddress();
    error MaxSupplyReached();

    // Constructor
    constructor(string memory name_, string memory symbol_, address admin, string memory baseURI_) ERC721(name_, symbol_) {
        if (admin == address(0)) revert ZeroAddress();
        _storedBaseURI = baseURI_;
        _grantRole(MINTER_ROLE, admin);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // Events
    event BaseURIChanged(string newBaseURI);

    // Overrides required by Solidity

    // Override _increaseBalance from ERC721 and ERC721Enumerable
    function _increaseBalance(address account, uint128 amount) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, amount);
    }

    // Override _update from ERC721 and ERC721Enumerable
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    // Override supportsInterface from ERC721, ERC721Enumerable, AccessControl, and ERC721Royalty
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable, AccessControl, ERC721Royalty) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // mint(address to) – only minter; tokenId auto-increments; max supply = 10 000.
    function mint(address to) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddress();
        uint256 tokenId = totalSupply() + 1;
        if (tokenId > 10000) revert MaxSupplyReached();
        _safeMint(to, tokenId);
        _setTokenRoyalty(tokenId, to, ROYALTY);
    }

    // Override _baseURI() from ERC721
    function _baseURI() internal view override returns (string memory) {
        return _storedBaseURI;
    }

    // Override tokenURI() from ERC721
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        return string(abi.encodePacked(_baseURI(), Strings.toString(tokenId), ".json"));
    }

    // setBaseURI(string) – only admin; stores IPFS base (e.g., ipfs://CID/).
    function setBaseURI(string memory baseURI_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _storedBaseURI = baseURI_; // Assign to the state variable

        // Emit event
        emit BaseURIChanged(baseURI_);
    }
}