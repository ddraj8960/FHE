const hre = require("hardhat");

async function main() {
  const RiskLog = await hre.ethers.getContractFactory("RiskLog");
  console.log("Deploying RiskLog contract...");
  const riskLog = await RiskLog.deploy();
  await riskLog.waitForDeployment();
  
  const address = await riskLog.getAddress();
  console.log(`RiskLog successfully deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
