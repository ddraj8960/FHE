// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RiskLog {
    struct RiskLogEntry {
        address wallet;
        bytes32 payloadHash;
        string riskLevel;
        uint256 timestamp;
    }

    mapping(uint256 => RiskLogEntry) public logs;
    uint256 public logCount;

    // Mapping from wallet address to their log entries
    mapping(address => RiskLogEntry[]) private userLogs;

    event LogCreated(uint256 indexed id, address indexed wallet, string riskLevel);

    function createLog(bytes32 payloadHash, string memory riskLevel) external {
        uint256 currentId = logCount;
        RiskLogEntry memory newLog = RiskLogEntry({
            wallet: msg.sender,
            payloadHash: payloadHash,
            riskLevel: riskLevel,
            timestamp: block.timestamp
        });

        logs[currentId] = newLog;
        userLogs[msg.sender].push(newLog);
        logCount++;

        emit LogCreated(currentId, msg.sender, riskLevel);
    }

    function createLogForUser(address user, bytes32 payloadHash, string memory riskLevel) external {
        uint256 currentId = logCount;
        RiskLogEntry memory newLog = RiskLogEntry({
            wallet: user,
            payloadHash: payloadHash,
            riskLevel: riskLevel,
            timestamp: block.timestamp
        });

        logs[currentId] = newLog;
        userLogs[user].push(newLog);
        logCount++;

        emit LogCreated(currentId, user, riskLevel);
    }

    function getLog(uint256 id) external view returns (RiskLogEntry memory) {
        require(id < logCount, "Log does not exist");
        return logs[id];
    }

    function getUserLogs(address wallet) external view returns (RiskLogEntry[] memory) {
        return userLogs[wallet];
    }
}
