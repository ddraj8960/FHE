import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';

// Setup local endpoints and contract ABI details
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const CLIENT_DAEMON_URL = 'http://localhost:5001';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const REGISTRY_ADDRESS = import.meta.env.VITE_REGISTRY_ADDRESS;
const GATE_ADDRESS = import.meta.env.VITE_GATE_ADDRESS;

// ABI for Contracts
const RISK_LOG_ABI = [
  "function createLog(bytes32 payloadHash, string memory riskLevel) external",
  "function logCount() external view returns (uint256)"
];

const PRE_TX_GATE_ABI = [
  "function acknowledgeRisk(address _protocol, string calldata _riskLevel) external"
];

// Pre-listed protocols for quick select
const PRE_LISTED_PROTOCOLS = [
  { name: "Aave V3 Pool", address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" },
  { name: "GMX V2 DataStore", address: "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8" },
  { name: "Euler V2 EVC", address: "0x0C9a3dd6b8F28529d72d7f9cE918D493519EE383" }
];

export default function Verify({ walletAddress, connectWallet }) {
  const [formData, setFormData] = useState({
    protocolSelect: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // default Aave
    customAddress: '',
    amount: '10000',
    portfolioConcentration: '15'
  });

  const [scanning, setScanning] = useState(false);
  const [contractReport, setContractReport] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0); // 1: Encrypting, 2: FHE Inference, 3: Blockchain Gate, 4: Logging Audit
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState(null);
  const [showProof, setShowProof] = useState(false);

  // Auto-scan on load / protocol change
  useEffect(() => {
    if (formData.protocolSelect !== 'custom') {
      handleScan(formData.protocolSelect);
    }
  }, [formData.protocolSelect]);

  const handleScan = async (addressToScan) => {
    const targetAddress = addressToScan || formData.customAddress;
    if (!targetAddress || !targetAddress.startsWith('0x')) {
      setErrorMsg("Please provide a valid smart contract address starting with 0x.");
      return;
    }

    setScanning(true);
    setErrorMsg('');
    try {
      const res = await axios.post(`${BACKEND_URL}/api/analyze-contract`, {
        address: targetAddress
      });
      setContractReport(res.data);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to analyze contract. Ensure the backend is active.");
    } finally {
      setScanning(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!walletAddress) {
      setErrorMsg('Please connect your MetaMask wallet to execute this flow.');
      return;
    }

    if (!contractReport) {
      setErrorMsg('Please scan the smart contract security metrics first.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setResult(null);

    const targetAddress = formData.protocolSelect === 'custom' ? formData.customAddress : formData.protocolSelect;

    try {
      // Step 1: Client-Side FHE Encryption
      setLoadingStep(1);
      
      // Feature normalization
      const amt = parseFloat(formData.amount) || 0;
      const amountNormalized = Math.min(amt / 100000, 1.0); // Normalize relative to $100K ceiling
      const portfolioConcNormalized = (parseFloat(formData.portfolioConcentration) || 0) / 100; // 0.0 - 1.0

      // Combined 6-feature vector
      // 1. investment_amount (Private FHE)
      // 2. protocol_risk_score (Public)
      // 3. contract_verification (Public)
      // 4. portfolio_concentration (Private FHE)
      // 5. protocol_maturity (Public)
      // 6. contract_code_risk (Public)
      const features = [
        amountNormalized,
        contractReport.protocol_risk_score,
        contractReport.contract_verification,
        portfolioConcNormalized,
        contractReport.protocol_maturity,
        contractReport.contract_code_risk
      ];

      // Request local daemon to encrypt inputs
      const encryptRes = await axios.post(`${CLIENT_DAEMON_URL}/api/client/encrypt`, {
        features: features
      });

      const { ciphertext, eval_key, ciphertext_hash } = encryptRes.data;

      // Step 2: Server-side blind FHE inference
      setLoadingStep(2);

      // Bucketing exact amount for db entry
      let investmentRange = "Under 10K";
      if (amt >= 10000 && amt < 50000) investmentRange = "10K-50K";
      else if (amt >= 50000 && amt < 200000) investmentRange = "50K-200K";
      else if (amt >= 200000) investmentRange = "Over 200K";

      // POST to backend API (the server NEVER sees plaintext features)
      const verifyRes = await axios.post(`${BACKEND_URL}/api/verify`, {
        ciphertext: ciphertext,
        eval_key: eval_key,
        wallet_address: walletAddress,
        investment_range: investmentRange,
        protocol_name: contractReport.name || targetAddress
      });

      const { encrypted_result, id: verificationId } = verifyRes.data;

      // Decrypt locally using the daemon
      const decryptRes = await axios.post(`${CLIENT_DAEMON_URL}/api/client/decrypt`, {
        encrypted_result: encrypted_result
      });

      const { prediction } = decryptRes.data;
      const riskMapping = { 0: "LOW", 1: "MEDIUM", 2: "HIGH" };
      const finalRiskLevel = riskMapping[prediction] || "MEDIUM";

      // Step 3: Call Pre-Transaction Gate Contract (Acknowledge Risk)
      setLoadingStep(3);

      if (!window.ethereum) {
        throw new Error("MetaMask is not installed. Unable to execute blockchain transactions.");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Initialize PreTxGate Contract
      const preTxGate = new ethers.Contract(GATE_ADDRESS, PRE_TX_GATE_ABI, signer);
      console.log(`Calling PreTxGate.acknowledgeRisk for protocol ${targetAddress} with risk level ${finalRiskLevel}`);
      
      const gateTx = await preTxGate.acknowledgeRisk(targetAddress, finalRiskLevel);
      await gateTx.wait();

      // Step 4: Write Audit Trail to RiskLog Contract
      setLoadingStep(4);
      
      const riskLog = new ethers.Contract(CONTRACT_ADDRESS, RISK_LOG_ABI, signer);
      let hexHash = ciphertext_hash.startsWith('0x') ? ciphertext_hash : `0x${ciphertext_hash}`;
      
      console.log(`Writing RiskLog entry for hash ${hexHash}`);
      const logTx = await riskLog.createLog(hexHash, finalRiskLevel);
      const receipt = await logTx.wait();

      // Submit blockchain confirmation to backend
      await axios.post(`${BACKEND_URL}/api/blockchain/confirm`, {
        id: verificationId,
        tx_hash: receipt.hash,
        risk_result: finalRiskLevel
      });

      setResult({
        id: verificationId,
        riskLevel: finalRiskLevel,
        ciphertextHash: ciphertext_hash,
        gateTxHash: gateTx.hash,
        logTxHash: receipt.hash,
        normalizedFeatures: features,
        ciphertext: ciphertext,
        evalKey: eval_key
      });

    } catch (err) {
      console.error(err);
      let errMsg = "An error occurred during verification.";
      if (err.response?.data?.detail) {
        errMsg = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : JSON.stringify(err.response.data.detail);
      } else if (err.message) {
        errMsg = err.message;
      }
      setErrorMsg(errMsg);
    } finally {
      setLoading(false);
      setLoadingStep(0);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="border border-[#152219] bg-[#0F1A16] p-6 glow-teal rounded-lg">
        <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-[#00D4AA] border-b border-[#152219] pb-3 mb-6 flex items-center justify-between">
          <span>DeFi Pre-Staking Verification Console</span>
          <span className="text-[10px] text-[#7FB89A]">Risk Gate ID: REG-8845</span>
        </h2>

        {!walletAddress ? (
          <div className="text-center py-8">
            <p className="text-[#7FB89A] text-sm font-mono mb-4 uppercase">MetaMask Connection Required</p>
            <button
              onClick={connectWallet}
              className="font-mono text-xs uppercase px-4 py-2 border border-[#00D4AA] text-[#00D4AA] hover:bg-[#00D4AA]/10 transition-colors duration-200"
            >
              Connect Wallet
            </button>
          </div>
        ) : loading ? (
          /* Processing Telemetry Step Indicators */
          <div className="py-12 flex flex-col items-center">
            <div className="relative w-16 h-16 mb-8 flex items-center justify-center">
              <div className="absolute inset-0 border border-[#00D4AA] rounded-full animate-spin-slow border-t-transparent border-b-transparent"></div>
              <span className="font-mono text-xs text-[#00D4AA] animate-pulse-soft">&lt;FHE&gt;</span>
            </div>

            <div className="w-full max-w-md space-y-4">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className={loadingStep >= 1 ? "text-[#00D4AA]" : "text-[#152219]"}>1. ENCRYPTING</span>
                <span className={loadingStep >= 2 ? "text-[#00D4AA]" : "text-[#152219]"}>2. INFERENCE</span>
                <span className={loadingStep >= 3 ? "text-[#00D4AA]" : "text-[#152219]"}>3. PRE-TX GATE</span>
                <span className={loadingStep >= 4 ? "text-[#00D4AA]" : "text-[#152219]"}>4. AUDIT LOG</span>
              </div>
              <div className="w-full bg-[#0A0F0D] h-2 border border-[#152219] p-[1px]">
                <div
                  className="bg-[#00D4AA] h-full transition-all duration-500"
                  style={{ width: `${(loadingStep / 4) * 100}%` }}
                ></div>
              </div>
              <p className="text-center font-mono text-xs text-[#7FB89A] uppercase tracking-wide">
                {loadingStep === 1 && "Client-side FHE key generation & user parameter encryption..."}
                {loadingStep === 2 && "Executing homomorphic risk inference on server (Zero Plaintext Exposure)..."}
                {loadingStep === 3 && "Invoking on-chain PreTxGate.sol risk acknowledgment..."}
                {loadingStep === 4 && "Broadcasting cryptographic audit receipt to RiskLog.sol..."}
              </p>
            </div>
          </div>
        ) : result ? (
          /* Verification Success Screen */
          <div className="space-y-6">
            <div className="p-4 border border-[#152219] bg-[#0A0F0D] text-center">
              <div className="font-mono text-xs text-[#7FB89A] uppercase mb-2">RISK EVALUATION COMPLETE</div>
              <span
                className={`font-mono text-2xl font-bold tracking-widest px-4 py-1 border ${
                  result.riskLevel === 'LOW'
                    ? 'border-[#00D4AA] text-[#00D4AA]'
                    : result.riskLevel === 'MEDIUM'
                    ? 'border-[#FFA502] text-[#FFA502]'
                    : 'border-[#FF4757] text-[#FF4757]'
                }`}
              >
                {result.riskLevel} RISK
              </span>
            </div>

            {/* Cryptographic telemetry and blockchain hashes */}
            <div className="space-y-3 font-mono text-xs text-[#7FB89A]">
              <div className="border border-[#152219] bg-[#0A0F0D]/60 p-3">
                <span className="text-[#E8F5F0] block mb-1">CIPHERTEXT SHA-256 HASH (ON-CHAIN PROOF)</span>
                <span className="break-all text-[11px] text-[#00D4AA]">{result.ciphertextHash}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-[#152219] bg-[#0A0F0D]/60 p-3">
                  <span className="text-[#E8F5F0] block mb-1">PRE-TX GATE TX HASH</span>
                  <a
                    href={`https://etherscan.io/tx/${result.gateTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-[11px] text-[#00D4AA] hover:underline"
                  >
                    {result.gateTxHash.substring(0, 20)}...
                  </a>
                </div>

                <div className="border border-[#152219] bg-[#0A0F0D]/60 p-3">
                  <span className="text-[#E8F5F0] block mb-1">AUDIT LOG TX HASH</span>
                  <a
                    href={`https://etherscan.io/tx/${result.logTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-[11px] text-[#00D4AA] hover:underline"
                  >
                    {result.logTxHash.substring(0, 20)}...
                  </a>
                </div>
              </div>
            </div>

            {/* Collapsible cryptographic details */}
            <div className="border border-[#152219] bg-[#0F1A16] p-3 shadow-inner">
              <button
                type="button"
                onClick={() => setShowProof(!showProof)}
                className="w-full text-left font-mono text-xs uppercase text-[#00D4AA] hover:text-[#33E0BB] flex justify-between items-center"
              >
                <span>{showProof ? "[-] Hide Cryptographic Proof" : "[+] Show Cryptographic Proof"}</span>
                <span className="text-[10px] text-[#7FB89A]">{showProof ? "COLLAPSE" : "EXPAND"}</span>
              </button>

              {showProof && (
                <div className="mt-4 pt-4 border-t border-[#152219] space-y-4 font-mono text-[11px] text-[#7FB89A]">
                  <div>
                    <span className="text-[#E8F5F0] block font-bold mb-1">1. DYNAMIC ON-CHAIN SCAN & AI AUDIT FEEDBACK (FEATURE #6)</span>
                    <div className="bg-[#050A08] p-2.5 border border-[#152219] space-y-1 text-xs">
                      <div>Protocol Name: <span className="text-[#00D4AA]">{contractReport.name}</span></div>
                      <div>Dynamic Code Risk Score (Feature #6): <span className="text-[#00D4AA]">{contractReport.contract_code_risk}</span></div>
                      <div>Verified Solidity: <span className="text-[#00D4AA]">{contractReport.verified ? "YES" : "NO"}</span></div>
                      <div>Vulnerabilities Detected: <span className="text-[#FF4757]">{contractReport.vulnerabilities}</span></div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[#E8F5F0] block font-bold mb-1">2. CLIENT-SIDE FHE ENCRYPTION (ZERO INTERNET EXPOSURE)</span>
                    <div className="bg-[#050A08] p-2.5 border border-[#152219] space-y-1 text-xs">
                      <div>Plaintext Hybrid Feature Vector: <span className="text-[#00D4AA]">{JSON.stringify(result.normalizedFeatures)}</span></div>
                      <div className="break-all">FHE Private Key: <span className="text-[#7FB89A] italic">[Securely kept in local FHE client enclave]</span></div>
                      <div className="break-all text-ellipsis overflow-hidden">FHE Ciphertext (Truncated): <span className="text-[#FFA502]">{result.ciphertext.substring(0, 60)}...</span></div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[#E8F5F0] block font-bold mb-1">3. SERVER-SIDE INFERENCE (ZERO-KNOWLEDGE GATEWAY)</span>
                    <div className="bg-[#050A08] p-2.5 border border-[#152219] space-y-1 text-xs">
                      <div>Server Inference Path: <span className="text-[#00D4AA]">{BACKEND_URL}/api/verify</span></div>
                      <div>Decryption Key on Server: <span className="text-[#FF4757] font-bold">ABSENT (Server evaluated logic blindly on ciphertext)</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setResult(null)}
              className="w-full font-mono text-xs uppercase py-3 border border-[#00D4AA] text-[#0A0F0D] bg-[#00D4AA] hover:bg-[#33E0BB] hover:border-[#33E0BB] transition-colors duration-200"
            >
              New Verification
            </button>
          </div>
        ) : (
          /* Staking Verification Form */
          <form onSubmit={handleVerify} className="space-y-4">
            {errorMsg && (
              <div className="p-3 border border-[#FF4757] bg-[#FF4757]/10 font-mono text-xs text-[#FF4757]">
                [ERROR] {errorMsg}
              </div>
            )}

            {/* Smart Contract Selection / Pasting */}
            <div>
              <label className="block font-mono text-xs uppercase text-[#7FB89A] mb-1.5">
                DeFi Target Protocol
              </label>
              <select
                name="protocolSelect"
                value={formData.protocolSelect}
                onChange={handleChange}
                className="w-full bg-[#0A0F0D] border border-[#152219] focus:border-[#00D4AA] focus:outline-none p-2.5 font-mono text-sm text-[#E8F5F0]"
              >
                {PRE_LISTED_PROTOCOLS.map((p) => (
                  <option key={p.address} value={p.address}>{p.name} ({p.address.substring(0, 6)}...{p.address.slice(-4)})</option>
                ))}
                <option value="custom">Paste Custom Contract Address</option>
              </select>
            </div>

            {formData.protocolSelect === 'custom' && (
              <div className="space-y-2">
                <label className="block font-mono text-xs uppercase text-[#7FB89A]">
                  Custom Contract Address (Ethereum/Arbitrum/Polygon)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="customAddress"
                    value={formData.customAddress}
                    onChange={handleChange}
                    placeholder="e.g. 0x87870Bca3..."
                    className="w-full bg-[#0A0F0D] border border-[#152219] focus:border-[#00D4AA] focus:outline-none p-2.5 font-mono text-sm text-[#E8F5F0]"
                  />
                  <button
                    type="button"
                    onClick={() => handleScan()}
                    disabled={scanning}
                    className="px-4 bg-[#00D4AA] hover:bg-[#33E0BB] text-[#0A0F0D] font-mono text-xs uppercase transition-colors"
                  >
                    {scanning ? "Scanning..." : "Scan"}
                  </button>
                </div>
              </div>
            )}

            {/* Security Audit Panel */}
            {contractReport && (
              <div className="p-4 border border-[#152219] bg-[#0A0F0D]/60 rounded space-y-3 font-mono text-xs text-[#7FB89A]">
                <div className="flex justify-between border-b border-[#152219] pb-2 text-[#E8F5F0]">
                  <span className="font-bold uppercase">DeFi Smart Contract Security Profile</span>
                  <span className="text-[#00D4AA] font-bold">Feature #6 Audit Level</span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                  <div>Contract Name: <span className="text-[#E8F5F0]">{contractReport.name}</span></div>
                  <div>Audit Score: <span className="text-[#00D4AA] font-bold">{contractReport.contract_code_risk}</span></div>
                  <div>Verified Source: <span className={contractReport.verified ? "text-[#00D4AA]" : "text-[#FF4757]"}>{contractReport.verified ? "YES" : "NO"}</span></div>
                  <div>Proxy/Upgradeable: <span className="text-[#E8F5F0]">{contractReport.upgradeable ? "YES" : "NO"}</span></div>
                  <div>Governance Model: <span className="text-[#E8F5F0]">{contractReport.owner_type}</span></div>
                  <div>Selfdestruct Found: <span className={contractReport.selfdestruct ? "text-[#FF4757]" : "text-[#00D4AA]"}>{contractReport.selfdestruct ? "YES" : "NO"}</span></div>
                </div>
                {contractReport.vulnerabilities && (
                  <div className="pt-2 border-t border-[#152219] text-[11px] text-[#FFA502]">
                    <span className="font-bold block mb-1">VULNERABILITY SUMMARY:</span>
                    {contractReport.vulnerabilities}
                  </div>
                )}
              </div>
            )}

            {/* Staking Amount */}
            <div>
              <label className="block font-mono text-xs uppercase text-[#7FB89A] mb-1.5">
                Staking / Investment Amount (USD)
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="1"
                placeholder="e.g. 5000"
                className="w-full bg-[#0A0F0D] border border-[#152219] focus:border-[#00D4AA] focus:outline-none p-2.5 font-mono text-sm text-[#E8F5F0]"
              />
            </div>

            {/* Portfolio Concentration Slider */}
            <div>
              <div className="flex justify-between font-mono text-xs uppercase text-[#7FB89A] mb-1">
                <span>Portfolio Concentration</span>
                <span className="text-[#00D4AA]">{formData.portfolioConcentration}%</span>
              </div>
              <input
                type="range"
                name="portfolioConcentration"
                min="1"
                max="100"
                value={formData.portfolioConcentration}
                onChange={handleChange}
                className="w-full accent-[#00D4AA]"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!contractReport || scanning}
              className="w-full font-mono text-xs uppercase py-3 border border-[#00D4AA] text-[#0A0F0D] bg-[#00D4AA] hover:bg-[#33E0BB] hover:border-[#33E0BB] transition-colors duration-200 glow-teal hover:glow-teal-strong mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Encrypt & Verify Staking Risk
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
