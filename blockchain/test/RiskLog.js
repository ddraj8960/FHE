const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RiskLog Contract", function () {
  let riskLog;
  let owner;
  let addr1;

  beforeEach(async function () {
    const RiskLog = await ethers.getContractFactory("RiskLog");
    riskLog = await RiskLog.deploy();
    await riskLog.waitForDeployment();
    [owner, addr1] = await ethers.getSigners();
  });

  it("Should successfully write a log entry and emit an event", async function () {
    const payloadHash = ethers.keccak256(ethers.toUtf8Bytes("test_transaction_payload"));
    const riskLevel = "LOW";

    await expect(riskLog.createLog(payloadHash, riskLevel))
      .to.emit(riskLog, "LogCreated")
      .withArgs(0, owner.address, riskLevel);

    expect(await riskLog.logCount()).to.equal(1);

    const entry = await riskLog.getLog(0);
    expect(entry.wallet).to.equal(owner.address);
    expect(entry.payloadHash).to.equal(payloadHash);
    expect(entry.riskLevel).to.equal(riskLevel);
  });

  it("Should return user specific logs", async function () {
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes("tx_1"));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("tx_2"));

    await riskLog.createLog(hash1, "LOW");
    await riskLog.connect(addr1).createLog(hash2, "HIGH");

    const ownerLogs = await riskLog.getUserLogs(owner.address);
    expect(ownerLogs.length).to.equal(1);
    expect(ownerLogs[0].payloadHash).to.equal(hash1);

    const addr1Logs = await riskLog.getUserLogs(addr1.address);
    expect(addr1Logs.length).to.equal(1);
    expect(addr1Logs[0].payloadHash).to.equal(hash2);
  });
});
