// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ProtocolRegistry {
    struct ProtocolRiskProfile {
        string name;
        uint256 tvlScore;           // 0 to 100
        uint256 auditCount;
        bool exploitHistory;        // true if exploited previously
        uint256 contractAge;        // age in days
        bool verificationStatus;    // true if source verified
        string compositeRiskTier;   // "LOW", "MEDIUM", "HIGH"
    }

    address public owner;
    mapping(address => ProtocolRiskProfile) public registry;
    address[] public protocolAddresses;

    event ProtocolUpdated(address indexed protocol, string name, string riskTier);

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setProtocol(
        address _protocol,
        string calldata _name,
        uint256 _tvlScore,
        uint256 _auditCount,
        bool _exploitHistory,
        uint256 _contractAge,
        bool _verificationStatus,
        string calldata _compositeRiskTier
    ) external onlyOwner {
        if (bytes(registry[_protocol].name).length == 0) {
            protocolAddresses.push(_protocol);
        }

        registry[_protocol] = ProtocolRiskProfile({
            name: _name,
            tvlScore: _tvlScore,
            auditCount: _auditCount,
            exploitHistory: _exploitHistory,
            contractAge: _contractAge,
            verificationStatus: _verificationStatus,
            compositeRiskTier: _compositeRiskTier
        });

        emit ProtocolUpdated(_protocol, _name, _compositeRiskTier);
    }

    function getProtocol(address _protocol) external view returns (ProtocolRiskProfile memory) {
        require(bytes(registry[_protocol].name).length > 0, "Protocol not registered");
        return registry[_protocol];
    }

    function getRegisteredProtocols() external view returns (address[] memory) {
        return protocolAddresses;
    }
}
