// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRiskLog {
    function logCount() external view returns (uint256);
}

contract PreTxGate {
    struct RiskAcknowledgment {
        address protocol;
        string riskLevel;
        uint256 timestamp;
        bool acknowledged;
    }

    address public owner;
    address public riskLogAddress;

    // Mapping of user wallet -> protocol address -> Acknowledgment details
    mapping(address => mapping(address => RiskAcknowledgment)) public userAcknowledgments;

    event RiskAcknowledged(
        address indexed wallet, 
        address indexed protocol, 
        string riskLevel, 
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    constructor(address _riskLogAddress) {
        owner = msg.sender;
        riskLogAddress = _riskLogAddress;
    }

    function setRiskLogAddress(address _riskLogAddress) external onlyOwner {
        riskLogAddress = _riskLogAddress;
    }

    function acknowledgeRisk(address _protocol, string calldata _riskLevel) external {
        userAcknowledgments[msg.sender][_protocol] = RiskAcknowledgment({
            protocol: _protocol,
            riskLevel: _riskLevel,
            timestamp: block.timestamp,
            acknowledged: true
        });

        emit RiskAcknowledged(msg.sender, _protocol, _riskLevel, block.timestamp);
    }

    function checkAcknowledgment(address _wallet, address _protocol) external view returns (bool, string memory) {
        RiskAcknowledgment memory ack = userAcknowledgments[_wallet][_protocol];
        return (ack.acknowledged, ack.riskLevel);
    }
}
