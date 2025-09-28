// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IVestingToken {
    function MINTER_ROLE() external view returns (bytes32);

    function grantRole(bytes32 role, address account) external;

    function mint(address to, uint256 amount) external;
}

contract VestingVault is ReentrancyGuard, AccessControl {
    // State Variables
    IVestingToken public immutable token;
    address public admin;

    // Custom Errors
    error ZeroAddress();
    error NotAuthorized();

    // Structs
    struct VestingSchedule {
        address beneficiary;
        uint64 cliff;
        uint64 duration;
        uint256 amount;
    }

    // Mappings
    mapping(uint256 => VestingSchedule) public vestingSchedules;
    uint256 public nextScheduleId;
    mapping(uint256 => uint256) public claimedAmounts;

    // Events
    event ScheduleCreated(
        uint256 indexed scheduleId,
        address indexed beneficiary,
        uint64 cliff,
        uint64 duration,
        uint256 amount
    );
    event Claimed(address indexed beneficiary, uint256 amount);

    // Constructor
    constructor(address tokenAddress, address adminAddress) {
        if (adminAddress == address(0)) revert ZeroAddress();
        token = IVestingToken(tokenAddress);
        admin = adminAddress;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // createSchedule() function - Only admin; stores schedule struct (mapping by ID)
    function createSchedule(
        address beneficiary,
        uint64 cliff,
        uint64 duration,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (duration == 0 || amount == 0) revert NotAuthorized();
        if (cliff < block.timestamp) revert NotAuthorized();
        vestingSchedules[nextScheduleId] = VestingSchedule(
            beneficiary,
            cliff,
            duration,
            amount
        );
        nextScheduleId++;
        // Emit event
        emit ScheduleCreated(
            nextScheduleId - 1,
            beneficiary,
            cliff,
            duration,
            amount
        );
    }

    // claim(uint scheduleId) – beneficiary pulls tokens vested up to block.timestamp. Uses pull over push pattern, emits Claimed.
    function claim(uint256 scheduleId) external nonReentrant {
        VestingSchedule storage vestingSchedule = vestingSchedules[scheduleId];
        if (vestingSchedule.beneficiary != msg.sender) revert NotAuthorized();
        uint64 cliff = vestingSchedule.cliff;
        uint64 duration = vestingSchedule.duration;
        uint256 amount = vestingSchedule.amount;
        uint256 vestedAmount;
        if (block.timestamp < cliff) {
            vestedAmount = 0;
        } else if (block.timestamp >= cliff + duration) {
            vestedAmount = amount;
        } else {
            vestedAmount = (amount * (block.timestamp - cliff)) / duration;
        }
        uint256 claimableAmount = vestedAmount - claimedAmounts[scheduleId];
        if (claimableAmount == 0) revert NotAuthorized();
        claimedAmounts[scheduleId] += claimableAmount;
        token.mint(msg.sender, claimableAmount);
        emit Claimed(msg.sender, claimableAmount);
    }
}
