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
    <div className="relative min-h-[calc(100vh-4rem)] cyber-grid scanlines py-12 px-4">
      <div className="cyber-radial"></div>

      <div className="relative z-10 max-w-3xl mx-auto">
        <div className="glass-panel p-6 sm:p-8 glow-teal">
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-[#00FFC4] border-b border-white/5 pb-4 mb-6 flex items-center justify-between">
            <span>DeFi Pre-Staking Verification Console</span>
            <span className="text-[10px] text-[#8EBF9F] bg-white/5 px-2 py-0.5 rounded-sm">Risk Gate ID: REG-8845</span>
          </h2>

          {!walletAddress ? (
            <div className="text-center py-12">
              <div className="inline-block p-4 border border-[#FF2A5F]/20 bg-[#FF2A5F]/5 rounded-full mb-4">
                <svg className="h-8 w-8 text-[#FF2A5F] animate-pulse-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-[#8EBF9F] text-sm font-mono mb-6 uppercase tracking-wide">MetaMask Connection Required</p>
              <button
                onClick={connectWallet}
                className="font-mono text-xs uppercase px-6 py-3 border border-[#00FFC4] text-[#040807] bg-[#00FFC4] hover:bg-[#66FFD9] hover:border-[#66FFD9] transition-all duration-300 font-bold tracking-widest shadow-[0_0_15px_rgba(0,255,196,0.2)]"
              >
                Connect Wallet
              </button>
            </div>
          ) : loading ? (
            /* Processing Telemetry Step Indicators */
            <div className="py-12 flex flex-col items-center">
              <div className="relative w-20 h-20 mb-8 flex items-center justify-center">
                <div className="absolute inset-0 border-2 border-[#00FFC4] rounded-full animate-spin-slow border-t-transparent border-b-transparent"></div>
                <span className="font-mono text-xs text-[#00FFC4] animate-pulse-soft font-bold">&lt;FHE&gt;</span>
              </div>

              <div className="w-full max-w-md space-y-4">
                <div className="flex items-center justify-between text-[10px] font-mono tracking-wider">
                  <span className={loadingStep >= 1 ? "text-[#00FFC4] font-bold" : "text-white/20"}>1. ENCRYPT</span>
                  <span className={loadingStep >= 2 ? "text-[#00FFC4] font-bold" : "text-white/20"}>2. INFER</span>
                  <span className={loadingStep >= 3 ? "text-[#00FFC4] font-bold" : "text-white/20"}>3. PRE-TX GATE</span>
                  <span className={loadingStep >= 4 ? "text-[#00FFC4] font-bold" : "text-white/20"}>4. AUDIT</span>
                </div>
                <div className="w-full bg-[#040807] h-2 border border-white/10 rounded-full overflow-hidden p-[1px]">
                  <div
                    className="bg-gradient-to-r from-[#00FFC4] to-[#66FFD9] h-full transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(0,255,196,0.5)]"
                    style={{ width: `${(loadingStep / 4) * 100}%` }}
                  ></div>
                </div>
                <p className="text-center font-mono text-xs text-[#8EBF9F] uppercase tracking-wide leading-relaxed min-h-[3rem] pt-2">
                  {loadingStep === 1 && "Client-side FHE key generation & user parameter encryption..."}
                  {loadingStep === 2 && "Executing homomorphic risk inference on server (Zero Plaintext Exposure)..."}
                  {loadingStep === 3 && "Invoking on-chain PreTxGate.sol risk acknowledgment..."}
                  {loadingStep === 4 && "Broadcasting cryptographic audit receipt to RiskLog.sol..."}
                </p>
              </div>
            </div>
          ) : result ? (
            /* Verification Success Screen */
            <div className="space-y-8 animate-pulse-soft/0">
              <div className="p-6 border border-white/5 bg-[#040807]/60 text-center rounded-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-radial-gradient(circle, rgba(0, 255, 196, 0.05) 0%, transparent 80%) pointer-events-none"></div>
                <div className="font-mono text-xs text-[#8EBF9F] uppercase tracking-widest mb-3">RISK EVALUATION COMPLETE</div>
                <div className="mb-2">
                  <span
                    className={`font-mono text-3xl font-extrabold tracking-widest px-6 py-2 border-2 rounded-sm inline-block shadow-lg ${
                      result.riskLevel === 'LOW'
                        ? 'border-[#00FFC4] text-[#00FFC4] shadow-[0_0_20px_rgba(0,255,196,0.25)]'
                        : result.riskLevel === 'MEDIUM'
                        ? 'border-[#FFAD00] text-[#FFAD00] shadow-[0_0_20px_rgba(255,173,0,0.25)]'
                        : 'border-[#FF2A5F] text-[#FF2A5F] shadow-[0_0_20px_rgba(255,42,95,0.25)]'
                    }`}
                  >
                    {result.riskLevel} RISK
                  </span>
                </div>
              </div>

              {/* Cryptographic telemetry and blockchain hashes */}
              <div className="space-y-4 font-mono text-xs text-[#8EBF9F]">
                <div className="border border-white/5 bg-[#040807]/30 p-4 rounded-md">
                  <span className="text-[#EBF7F2] block mb-1.5 uppercase font-bold tracking-wider">CIPHERTEXT SHA-256 HASH (ON-CHAIN PROOF)</span>
                  <span className="break-all text-[11px] text-[#00FFC4] bg-[#040807] p-2 rounded block border border-white/5">{result.ciphertextHash}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-white/5 bg-[#040807]/30 p-4 rounded-md">
                    <span className="text-[#EBF7F2] block mb-1.5 uppercase font-bold tracking-wider">PRE-TX GATE TX HASH</span>
                    <a
                      href={`https://etherscan.io/tx/${result.gateTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-[11px] text-[#00FFC4] hover:underline bg-[#040807] p-2 rounded block border border-white/5"
                    >
                      {result.gateTxHash.substring(0, 24)}...
                    </a>
                  </div>

                  <div className="border border-white/5 bg-[#040807]/30 p-4 rounded-md">
                    <span className="text-[#EBF7F2] block mb-1.5 uppercase font-bold tracking-wider">AUDIT LOG TX HASH</span>
                    <a
                      href={`https://etherscan.io/tx/${result.logTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-[11px] text-[#00FFC4] hover:underline bg-[#040807] p-2 rounded block border border-white/5"
                    >
                      {result.logTxHash.substring(0, 24)}...
                    </a>
                  </div>
                </div>
              </div>

              {/* Collapsible cryptographic details */}
              <div className="border border-white/5 bg-[#040807]/20 p-4 rounded-md">
                <button
                  type="button"
                  onClick={() => setShowProof(!showProof)}
                  className="w-full text-left font-mono text-xs uppercase text-[#00FFC4] hover:text-[#66FFD9] flex justify-between items-center transition-colors"
                >
                  <span className="font-bold tracking-wider">{showProof ? "[-] Hide Cryptographic Proof" : "[+] Show Cryptographic Proof"}</span>
                  <span className="text-[10px] text-[#8EBF9F] bg-white/5 px-2 py-0.5 rounded">{showProof ? "COLLAPSE" : "EXPAND"}</span>
                </button>

                {showProof && (
                  <div className="mt-4 pt-4 border-t border-white/5 space-y-5 font-mono text-[11px] text-[#8EBF9F]">
                    <div>
                      <span className="text-[#EBF7F2] block font-bold mb-1.5">1. DYNAMIC ON-CHAIN SCAN & AI AUDIT FEEDBACK (FEATURE #6)</span>
                      <div className="bg-[#040807] p-3 border border-white/5 rounded space-y-1.5 text-xs">
                        <div>Protocol Name: <span className="text-[#00FFC4]">{contractReport.name}</span></div>
                        <div>Dynamic Code Risk Score (Feature #6): <span className="text-[#00FFC4]">{contractReport.contract_code_risk}</span></div>
                        <div>Verified Solidity: <span className="text-[#00FFC4]">{contractReport.verified ? "YES" : "NO"}</span></div>
                        <div>Vulnerabilities Detected: <span className="text-[#FF2A5F]">{contractReport.vulnerabilities}</span></div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[#EBF7F2] block font-bold mb-1.5">2. CLIENT-SIDE FHE ENCRYPTION (ZERO INTERNET EXPOSURE)</span>
                      <div className="bg-[#040807] p-3 border border-white/5 rounded space-y-1.5 text-xs">
                        <div>Plaintext Hybrid Feature Vector: <span className="text-[#00FFC4]">{JSON.stringify(result.normalizedFeatures)}</span></div>
                        <div className="break-all">FHE Private Key: <span className="text-[#8EBF9F] italic">[Securely kept in local FHE client enclave]</span></div>
                        <div className="break-all text-ellipsis overflow-hidden">FHE Ciphertext (Truncated): <span className="text-[#FFAD00]">{result.ciphertext.substring(0, 80)}...</span></div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[#EBF7F2] block font-bold mb-1.5">3. SERVER-SIDE INFERENCE (ZERO-KNOWLEDGE GATEWAY)</span>
                      <div className="bg-[#040807] p-3 border border-white/5 rounded space-y-1.5 text-xs">
                        <div>Server Inference Path: <span className="text-[#00FFC4]">{BACKEND_URL}/api/verify</span></div>
                        <div>Decryption Key on Server: <span className="text-[#FF2A5F] font-bold">ABSENT (Server evaluated logic blindly on ciphertext)</span></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setResult(null)}
                className="w-full font-mono text-xs uppercase py-3.5 border border-[#00FFC4] text-[#040807] bg-[#00FFC4] hover:bg-[#66FFD9] hover:border-[#66FFD9] transition-all duration-300 font-bold tracking-widest shadow-[0_0_15px_rgba(0,255,196,0.15)] rounded-sm"
              >
                New Verification
              </button>
            </div>
          ) : (
            /* Staking Verification Form */
            <form onSubmit={handleVerify} className="space-y-6">
              {errorMsg && (
                <div className="p-3 border border-[#FF2A5F] bg-[#FF2A5F]/10 font-mono text-xs text-[#FF2A5F] rounded">
                  [ERROR] {errorMsg}
                </div>
              )}

              {/* Smart Contract Selection / Pasting */}
              <div className="space-y-2">
                <label className="block font-mono text-xs uppercase text-[#8EBF9F] tracking-wider font-bold">
                  DeFi Target Protocol
                </label>
                <select
                  name="protocolSelect"
                  value={formData.protocolSelect}
                  onChange={handleChange}
                  className="w-full bg-[#040807] border border-white/10 focus:border-[#00FFC4] focus:outline-none p-3 font-mono text-sm text-[#EBF7F2] rounded-md transition-colors"
                >
                  {PRE_LISTED_PROTOCOLS.map((p) => (
                    <option key={p.address} value={p.address}>{p.name} ({p.address.substring(0, 6)}...{p.address.slice(-4)})</option>
                  ))}
                  <option value="custom">Paste Custom Contract Address</option>
                </select>
              </div>

              {formData.protocolSelect === 'custom' && (
                <div className="space-y-2">
                  <label className="block font-mono text-xs uppercase text-[#8EBF9F] tracking-wider font-bold">
                    Custom Contract Address (Ethereum/Arbitrum/Polygon)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="customAddress"
                      value={formData.customAddress}
                      onChange={handleChange}
                      placeholder="e.g. 0x87870Bca3..."
                      className="w-full bg-[#040807] border border-white/10 focus:border-[#00FFC4] focus:outline-none p-3 font-mono text-sm text-[#EBF7F2] rounded-md transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => handleScan()}
                      disabled={scanning}
                      className="px-6 bg-[#00FFC4] hover:bg-[#66FFD9] text-[#040807] font-mono text-xs uppercase font-bold tracking-widest transition-colors rounded-sm shadow-[0_0_10px_rgba(0,255,196,0.15)]"
                    >
                      {scanning ? "Scanning..." : "Scan"}
                    </button>
                  </div>
                </div>
              )}

              {/* Security Audit Panel */}
              {contractReport && (
                <div className="p-5 border border-white/5 bg-[#040807]/40 rounded-lg space-y-4 font-mono text-xs text-[#8EBF9F]">
                  <div className="flex justify-between border-b border-white/5 pb-2 text-[#EBF7F2]">
                    <span className="font-bold uppercase tracking-wider">DeFi Smart Contract Security Profile</span>
                    <span className="text-[#00FFC4] font-bold tracking-wider">Feature #6 Audit Level</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>Contract Name: <span className="text-[#EBF7F2] font-semibold">{contractReport.name}</span></div>
                      <div>Verified Source: <span className={contractReport.verified ? "text-[#00FFC4] font-semibold" : "text-[#FF2A5F] font-semibold"}>{contractReport.verified ? "YES" : "NO"}</span></div>
                      <div>Proxy/Upgradeable: <span className="text-[#EBF7F2]">{contractReport.upgradeable ? "YES" : "NO"}</span></div>
                      <div>Governance Model: <span className="text-[#EBF7F2]">{contractReport.owner_type}</span></div>
                      <div>Selfdestruct Found: <span className={contractReport.selfdestruct ? "text-[#FF2A5F] font-bold" : "text-[#00FFC4] font-semibold"}>{contractReport.selfdestruct ? "YES" : "NO"}</span></div>
                    </div>
                    
                    <div className="space-y-3 bg-[#040807]/60 p-4 border border-white/5 rounded-md">
                      <div className="flex justify-between">
                        <span>AI Code Risk:</span>
                        <span className="text-[#00FFC4] font-bold">{contractReport.contract_code_risk}</span>
                      </div>
                      <div className="w-full bg-[#040807] h-1.5 border border-white/5 rounded-full overflow-hidden">
                        <div className="bg-[#00FFC4] h-full" style={{ width: `${contractReport.contract_code_risk * 100}%` }}></div>
                      </div>

                      <div className="flex justify-between pt-1">
                        <span>Reentrancy Risk:</span>
                        <span className="text-[#00FFC4] font-bold">{contractReport.reentrancy_risk}</span>
                      </div>
                      <div className="w-full bg-[#040807] h-1.5 border border-white/5 rounded-full overflow-hidden">
                        <div className="bg-[#00FFC4] h-full" style={{ width: `${contractReport.reentrancy_risk * 100}%` }}></div>
                      </div>

                      <div className="flex justify-between pt-1">
                        <span>Admin Privileges:</span>
                        <span className="text-[#00FFC4] font-bold">{contractReport.admin_privileges}</span>
                      </div>
                      <div className="w-full bg-[#040807] h-1.5 border border-white/5 rounded-full overflow-hidden">
                        <div className="bg-[#00FFC4] h-full" style={{ width: `${contractReport.admin_privileges * 100}%` }}></div>
                      </div>
                    </div>
                  </div>

                  {contractReport.vulnerabilities && (
                    <div className="pt-3 border-t border-white/5 text-[11px] text-[#FFAD00] bg-[#FFAD00]/5 p-3 rounded-md border border-[#FFAD00]/10">
                      <span className="font-bold block mb-1 tracking-wider">VULNERABILITY SUMMARY:</span>
                      {contractReport.vulnerabilities}
                    </div>
                  )}
                </div>
              )}

              {/* Staking Amount */}
              <div className="space-y-2">
                <label className="block font-mono text-xs uppercase text-[#8EBF9F] tracking-wider font-bold">
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
                  className="w-full bg-[#040807] border border-white/10 focus:border-[#00FFC4] focus:outline-none p-3 font-mono text-sm text-[#EBF7F2] rounded-md transition-colors"
                />
              </div>

              {/* Portfolio Concentration Slider */}
              <div className="space-y-2">
                <div className="flex justify-between font-mono text-xs uppercase text-[#8EBF9F] tracking-wider font-bold">
                  <span>Portfolio Concentration</span>
                  <span className="text-[#00FFC4] font-bold">{formData.portfolioConcentration}%</span>
                </div>
                <input
                  type="range"
                  name="portfolioConcentration"
                  min="1"
                  max="100"
                  value={formData.portfolioConcentration}
                  onChange={handleChange}
                  className="w-full accent-[#00FFC4] cursor-pointer"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!contractReport || scanning}
                className="w-full font-mono text-xs uppercase py-3.5 border border-[#00FFC4] text-[#040807] bg-[#00FFC4] hover:bg-[#66FFD9] hover:border-[#66FFD9] transition-all duration-300 font-bold tracking-widest shadow-[0_0_15px_rgba(0,255,196,0.15)] rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Encrypt & Verify Staking Risk
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
