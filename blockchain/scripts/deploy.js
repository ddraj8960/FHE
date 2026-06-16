const hre = require("hardhat");

async function main() {
  // 1. Deploy RiskLog
  const RiskLog = await hre.ethers.getContractFactory("RiskLog");
  console.log("Deploying RiskLog contract...");
  const riskLog = await RiskLog.deploy();
  await riskLog.waitForDeployment();
  const riskLogAddress = await riskLog.getAddress();
  console.log(`RiskLog successfully deployed to: ${riskLogAddress}`);

  // 2. Deploy ProtocolRegistry
  const ProtocolRegistry = await hre.ethers.getContractFactory("ProtocolRegistry");
  console.log("Deploying ProtocolRegistry contract...");
  const protocolRegistry = await ProtocolRegistry.deploy();
  await protocolRegistry.waitForDeployment();
  const protocolRegistryAddress = await protocolRegistry.getAddress();
  console.log(`ProtocolRegistry successfully deployed to: ${protocolRegistryAddress}`);

  // 3. Deploy PreTxGate
  const PreTxGate = await hre.ethers.getContractFactory("PreTxGate");
  console.log("Deploying PreTxGate contract...");
  const preTxGate = await PreTxGate.deploy(riskLogAddress);
  await preTxGate.waitForDeployment();
  const preTxGateAddress = await preTxGate.getAddress();
  console.log(`PreTxGate successfully deployed to: ${preTxGateAddress}`);

  // 4. Pre-populate ProtocolRegistry with real on-chain details for Aave, GMX, Euler
  console.log("Pre-populating ProtocolRegistry...");
  
  // Aave V3 Pool
  await protocolRegistry.setProtocol(
    "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    "Aave V3 Pool",
    95, // tvlScore
    8,  // auditCount
    false, // exploitHistory
    1200, // contractAge (days)
    true, // verificationStatus
    "LOW"
  );
  console.log("Aave V3 Pool set in registry.");

  // GMX V2 DataStore
  await protocolRegistry.setProtocol(
    "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8",
    "GMX V2 DataStore",
    60, // tvlScore
    3,  // auditCount
    true, // exploitHistory (V1 was exploited)
    1000, // contractAge (days)
    true, // verificationStatus
    "MEDIUM"
  );
  console.log("GMX V2 DataStore set in registry.");

  // Euler V2 EVC
  await protocolRegistry.setProtocol(
    "0x0C9a3dd6b8F28529d72d7f9cE918D493519EE383",
    "Euler V2 EVC",
    30, // tvlScore
    16, // auditCount
    true, // exploitHistory (V1 suffered exploit)
    600,  // contractAge (days)
    true, // verificationStatus
    "HIGH"
  );
  console.log("Euler V2 EVC set in registry.");

  console.log("------------------------------------------------");
  console.log("Deployment Summary:");
  console.log(`RiskLog: ${riskLogAddress}`);
  console.log(`ProtocolRegistry: ${protocolRegistryAddress}`);
  console.log(`PreTxGate: ${preTxGateAddress}`);
  console.log("------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
