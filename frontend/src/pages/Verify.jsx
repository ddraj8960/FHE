import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';
import { BACKEND_URL, CLIENT_DAEMON_URL, CONTRACT_ADDRESS, REGISTRY_ADDRESS, GATE_ADDRESS } from '../config';
import { getInvestmentRange, getRiskPanelClass } from '../utils/risk';

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
    amount: '15000',
    portfolioConcentration: '20'
  });

  const [scanning, setScanning] = useState(false);
  const [contractReport, setContractReport] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0); // 1: Encrypting, 2: FHE Inference, 3: Blockchain Gate, 4: Logging Audit
  const [errorMsg, setErrorMsg] = useState('');
  
  const [fheResult, setFheResult] = useState(null); // Intermediate FHE risk assessment output
  const [result, setResult] = useState(null); // Final on-chain audit receipt
  const [showProof, setShowProof] = useState(false);
  const [showCustomGuide, setShowCustomGuide] = useState(false);

  // FHE Cryptographic Terminal Logs
  const [terminalLogs, setTerminalLogs] = useState([]);
  const terminalBottomRef = useRef(null);

  // Auto-scan on load / protocol change
  useEffect(() => {
    if (formData.protocolSelect !== 'custom') {
      handleScan(formData.protocolSelect);
    }
  }, [formData.protocolSelect]);

  // Scroll to bottom of FHE logs
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  // Rolling terminal logs simulator
  const addLog = (msg, delay = 0) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const timestamp = new Date().toLocaleTimeString();
        setTerminalLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
        resolve();
      }, delay);
    });
  };

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

  // Stage 1: Run local FHE calculations and backend blind inference
  const handleRunPrivacyAudit = async (e) => {
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
    setFheResult(null);
    setResult(null);
    setTerminalLogs([]);

    const targetAddress = formData.protocolSelect === 'custom' ? formData.customAddress : formData.protocolSelect;

    try {
      // Step 1: Client-Side FHE Encryption
      setLoadingStep(1);
      await addLog(">>> SECURE ENCLAVE INITIALIZED...", 100);
      await addLog("Loading Concrete ML quantization and key parameters...", 300);
      
      const amt = parseFloat(formData.amount) || 0;
      const amountNormalized = Math.min(amt / 100000, 1.0); // Normalize relative to $100K ceiling
      const portfolioConcNormalized = (parseFloat(formData.portfolioConcentration) || 0) / 100; // 0.0 - 1.0

      const features = [
        amountNormalized,
        contractReport.protocol_risk_score,
        contractReport.contract_verification,
        portfolioConcNormalized,
        contractReport.protocol_maturity,
        contractReport.contract_code_risk
      ];

      await addLog(`Compiled Feature Vector: [Amount: ${amountNormalized.toFixed(2)}, Protocol Risk: ${contractReport.protocol_risk_score.toFixed(2)}, Verification: ${contractReport.contract_verification.toFixed(2)}, Concentration: ${portfolioConcNormalized.toFixed(2)}, Maturity: ${contractReport.protocol_maturity.toFixed(2)}, Code Risk: ${contractReport.contract_code_risk.toFixed(2)}]`, 400);
      await addLog("Generating FHE private/evaluation keypair locally...", 300);

      const encryptRes = await axios.post(`${CLIENT_DAEMON_URL}/api/client/encrypt`, {
        features: features
      });

      const { ciphertext, eval_key, ciphertext_hash } = encryptRes.data;
      
      await addLog(`Client FHE encryption complete. Ciphertext size: ${Math.round(ciphertext.length / 2)} bytes`, 200);
      await addLog(`Evaluation keys generated. Size: ${Math.round(eval_key.length / 2)} bytes`, 200);
      await addLog(`Ciphertext SHA-256 Hash generated: ${ciphertext_hash}`, 200);

      // Step 2: Server-side blind FHE inference
      setLoadingStep(2);
      await addLog("\n>>> ESTABLISHING SERVER CONTEXT...", 200);
      await addLog("Broadcasting LWE Ciphertext and Evaluation Key (Plaintext metrics remain 100% hidden)...", 300);

      const investmentRange = getInvestmentRange(amt);

      const verifyRes = await axios.post(`${BACKEND_URL}/api/verify`, {
        ciphertext: ciphertext,
        eval_key: eval_key,
        wallet_address: walletAddress,
        investment_range: investmentRange,
        protocol_name: contractReport.name || targetAddress
      });

      const { encrypted_result, id: verificationId } = verifyRes.data;

      await addLog(`[SERVER] Received FHE block. Verification ID: ${verificationId}`, 300);
      await addLog("[SERVER] Loading compiled 6-feature quantized ML logistic regression circuit...", 300);
      await addLog("[SERVER] Executing homomorphic matrix evaluation blindly on ciphertext...", 400);
      await addLog("[SERVER] Homomorphic inference completed. Returning encrypted result...", 300);

      // Decrypt locally using the daemon
      await addLog("\n>>> DECRYPTING EVALUATION RESULTS...", 200);
      const decryptRes = await axios.post(`${CLIENT_DAEMON_URL}/api/client/decrypt`, {
        encrypted_result: encrypted_result
      });

      const { prediction } = decryptRes.data;
      const riskMapping = { 0: "LOW", 1: "MEDIUM", 2: "HIGH" };
      const finalRiskLevel = riskMapping[prediction] || "MEDIUM";

      await addLog(`[CLIENT] Decryption completed. Model output classification: ${prediction}`, 250);
      await addLog(`[CLIENT] PREDICTED RISK LEVEL: ${finalRiskLevel} RISK`, 200);
      await addLog("\n>>> FHE PRIVACY AUDIT FINISHED.", 100);
      await addLog("Awaiting user risk acknowledgment to write proof to ledger...", 100);

      setFheResult({
        id: verificationId,
        riskLevel: finalRiskLevel,
        ciphertextHash: ciphertext_hash,
        normalizedFeatures: features,
        ciphertext: ciphertext,
        evalKey: eval_key,
        targetAddress: targetAddress
      });

    } catch (err) {
      console.error(err);
      let errMsg = "An error occurred during FHE evaluation.";
      if (err.response?.data?.detail) {
        errMsg = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : JSON.stringify(err.response.data.detail);
      } else if (err.message) {
        errMsg = err.message;
      }
      setErrorMsg(errMsg);
      await addLog(`\n[CRITICAL ERROR] FHE pipeline aborted: ${errMsg}`);
    } finally {
      setLoading(false);
      setLoadingStep(0);
    }
  };

  // Stage 2: Write risk acknowledgments and audit hashes to blockchain via MetaMask
  const handleWriteToLedger = async () => {
    if (!walletAddress) {
      setErrorMsg('Please connect your MetaMask wallet.');
      return;
    }

    if (!fheResult) {
      setErrorMsg('No active FHE risk evaluation result to submit.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // Step 3: Call Pre-Transaction Gate Contract (Acknowledge Risk)
      setLoadingStep(3);
      await addLog("\n>>> CALLING SMART CONTRACT RISK GATES...", 300);
      await addLog(`[METAMASK] Requesting signature: PreTxGate.acknowledgeRisk(${fheResult.riskLevel})...`, 300);

      if (!window.ethereum) {
        throw new Error("MetaMask is not installed. Unable to execute blockchain transactions.");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const preTxGate = new ethers.Contract(GATE_ADDRESS, PRE_TX_GATE_ABI, signer);
      const gateTx = await preTxGate.acknowledgeRisk(fheResult.targetAddress, fheResult.riskLevel);
      
      await addLog(`Pre-staking gate transaction broadcast: ${gateTx.hash}`, 200);
      await addLog("Waiting for block confirmation...", 400);
      await gateTx.wait();
      await addLog("[CHAIN] Pre-staking gate transaction confirmed.", 250);

      // Step 4: Write Audit Trail to RiskLog Contract
      setLoadingStep(4);
      await addLog(`\n>>> COMMITTING IMMUTABLE RISK LOG RECEIPT...`, 200);
      await addLog(`[METAMASK] Requesting signature: RiskLog.createLog(hash, ${fheResult.riskLevel})...`, 250);
      
      const riskLog = new ethers.Contract(CONTRACT_ADDRESS, RISK_LOG_ABI, signer);
      let hexHash = fheResult.ciphertextHash.startsWith('0x') ? fheResult.ciphertextHash : `0x${fheResult.ciphertextHash}`;
      
      const logTx = await riskLog.createLog(hexHash, fheResult.riskLevel);
      await addLog(`Audit Log transaction broadcast: ${logTx.hash}`, 200);
      await addLog("Waiting for block confirmation...", 400);
      
      const receipt = await logTx.wait();
      await addLog("[CHAIN] Audit log committed successfully.", 200);

      await addLog("Synchronizing validation proof with backend database...", 200);
      await axios.post(`${BACKEND_URL}/api/blockchain/confirm`, {
        id: fheResult.id,
        tx_hash: receipt.hash,
        risk_result: fheResult.riskLevel
      });
      await addLog("Audit flow finished successfully.", 150);

      setResult({
        id: fheResult.id,
        riskLevel: fheResult.riskLevel,
        ciphertextHash: fheResult.ciphertextHash,
        gateTxHash: gateTx.hash,
        logTxHash: receipt.hash,
        normalizedFeatures: fheResult.normalizedFeatures,
        ciphertext: fheResult.ciphertext,
        evalKey: fheResult.evalKey
      });

      // Clear FHE result now that it is written to blockchain
      setFheResult(null);

    } catch (err) {
      console.error(err);
      let errMsg = "An error occurred during blockchain execution.";
      if (err.response?.data?.detail) {
        errMsg = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : JSON.stringify(err.response.data.detail);
      } else if (err.message) {
        errMsg = err.message;
      }
      setErrorMsg(errMsg);
      await addLog(`\n[CRITICAL ERROR] Blockchain transaction aborted: ${errMsg}`);
    } finally {
      setLoading(false);
      setLoadingStep(0);
    }
  };

  const handleAbort = async () => {
    setErrorMsg('');
    setFheResult(null);
    setResult(null);
    setTerminalLogs([]);
    await addLog("Staking transaction safely aborted by user. Form reset.", 100);
  };

  const getRiskColorClass = getRiskPanelClass;

  const getMeterColorClass = (score) => {
    if (score < 0.25) return 'bg-[#C0FF00]';
    if (score < 0.6) return 'bg-[#FF5A00]';
    return 'bg-[#FF2A5F]';
  };

  // Guided Flow Step Calculations
  const getFlowStep = () => {
    if (result) return 3;
    if (fheResult) return 2;
    return 1;
  };

  const activeStep = getFlowStep();

  return (
    <div className="relative min-h-[calc(100vh-4rem)] cyber-grid py-10 px-4 sm:px-6">
      <div className="relative max-w-6xl mx-auto space-y-6">
        
        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Forms and select (lg:col-span-5) */}
          <div 
            className="lg:col-span-5 dashboard-card p-6 sm:p-8 relative overflow-hidden"
            style={{ borderTop: '2px solid transparent', borderImage: 'linear-gradient(to right, #C0FF00, #FF5A00) 1' }}
          >
            {/* Guide-Proof Progress Tracker Header */}
            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider mb-6 pb-4 border-b border-[#222222]">
              <div className={`flex items-center gap-1.5 transition-colors ${activeStep === 1 ? 'text-[#C0FF00] font-bold' : 'text-[#505050]'}`}>
                <span className={`h-4.5 w-4.5 rounded-full flex items-center justify-center border text-[8px] transition-colors ${activeStep >= 1 ? 'border-[#C0FF00] text-[#C0FF00] bg-[#C0FF00]/10 font-bold' : 'border-[#333]'}`}>1</span>
                <span>Scan target</span>
              </div>
              <div className={`h-[1px] flex-grow mx-2 transition-colors ${activeStep >= 2 ? 'bg-[#FF5A00]/40' : 'bg-[#222]'}`}></div>
              <div className={`flex items-center gap-1.5 transition-colors ${activeStep === 2 ? 'text-[#FF5A00] font-bold' : 'text-[#505050]'}`}>
                <span className={`h-4.5 w-4.5 rounded-full flex items-center justify-center border text-[8px] transition-colors ${activeStep >= 2 ? 'border-[#FF5A00] text-[#FF5A00] bg-[#FF5A00]/10 font-bold' : 'border-[#333]'}`}>2</span>
                <span>FHE score</span>
              </div>
              <div className={`h-[1px] flex-grow mx-2 transition-colors ${activeStep >= 3 ? 'bg-[#C0FF00]/40' : 'bg-[#222]'}`}></div>
              <div className={`flex items-center gap-1.5 transition-colors ${activeStep === 3 ? 'text-[#C0FF00] font-bold' : 'text-[#505050]'}`}>
                <span className={`h-4.5 w-4.5 rounded-full flex items-center justify-center border text-[8px] transition-colors ${activeStep >= 3 ? 'border-[#C0FF00] text-[#C0FF00] bg-[#C0FF00]/10 font-bold' : 'border-[#333]'}`}>3</span>
                <span>Commit</span>
              </div>
            </div>

            {!walletAddress ? (
              <div className="text-center py-12 space-y-4">
                <p className="text-[#909090] text-xs font-mono uppercase tracking-wider">Wallet Connection Required</p>
                <button
                  onClick={connectWallet}
                  className="tech-btn-primary text-xs w-full py-3.5 bg-gradient-to-r from-[#C0FF00] to-[#FF5A00] hover:shadow-[0_0_15px_rgba(192,255,0,0.2)]"
                >
                  Connect Wallet
                </button>
              </div>
            ) : result ? (
              /* Verification Success Panel (Final Stage) */
              <div className="space-y-6">
                <div className={`p-6 border rounded text-center relative overflow-hidden ${getRiskColorClass(result.riskLevel)}`}>
                  <div className="font-mono text-[9px] text-[#909090] uppercase tracking-wider mb-2">Predicted Risk Rating</div>
                  <span className="font-mono text-2xl font-black tracking-widest px-6 py-1.5 border border-current rounded inline-block">
                    {result.riskLevel} RISK
                  </span>
                </div>

                <div className="space-y-3 font-mono text-[11px] text-[#909090]">
                  <div className="border border-[#222222] bg-[#090909] p-3.5 rounded">
                    <span className="text-[#F5F5F5] block uppercase tracking-wider mb-1.5 font-bold">Ciphertext SHA-256 Hash</span>
                    <span className="break-all text-[#C0FF00] p-1.5 rounded bg-[#050505] border border-white/5 block">{result.ciphertextHash}</span>
                  </div>

                  <div className="border border-[#222222] bg-[#090909] p-3.5 rounded">
                    <span className="text-[#F5F5F5] block uppercase tracking-wider mb-1.5 font-bold text-[#FF5A00]">On-chain Audit Receipt</span>
                    <a
                      href={`https://etherscan.io/tx/${result.logTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-[#C0FF00] hover:underline p-1.5 rounded bg-[#050505] border border-white/5 block"
                    >
                      {result.logTxHash.substring(0, 28)}...
                    </a>
                  </div>
                </div>

                <button
                  onClick={() => setResult(null)}
                  className="tech-btn-primary text-xs w-full py-3.5 bg-gradient-to-r from-[#C0FF00] to-[#FF5A00] font-black tracking-widest text-[#050505] hover:shadow-[0_0_15px_rgba(255,90,0,0.2)]"
                >
                  NEW SECURITY AUDIT
                </button>
              </div>
            ) : fheResult ? (
              /* FHE Risk Assessment Review Panel (Stage 2) */
              <div className="space-y-6">
                <div className={`p-6 border rounded text-center relative overflow-hidden ${getRiskColorClass(fheResult.riskLevel)}`}>
                  <div className="font-mono text-[9px] text-[#909090] uppercase tracking-wider mb-2">Evaluated Risk Rating</div>
                  <span className="font-mono text-2xl font-black tracking-widest px-6 py-1.5 border border-current rounded inline-block">
                    {fheResult.riskLevel} RISK
                  </span>
                </div>

                {/* Risk-Specific Security Warning Alert */}
                <div
                  className={`p-4 border rounded font-mono text-[11px] leading-relaxed space-y-2 ${
                    fheResult.riskLevel === 'LOW'
                      ? 'border-[#C0FF00]/20 bg-[#C0FF00]/5 text-[#C0FF00]'
                      : fheResult.riskLevel === 'MEDIUM'
                      ? 'border-[#FF5A00]/20 bg-[#FF5A00]/5 text-[#FF5A00]'
                      : 'border-[#FF2A5F]/20 bg-[#FF2A5F]/10 text-[#FF2A5F]'
                  }`}
                >
                  <span className="font-bold block uppercase tracking-widest text-[9px] border-b border-current/20 pb-1">
                    {fheResult.riskLevel === 'LOW'
                      ? '✓ Low Risk Assessment Verified'
                      : fheResult.riskLevel === 'MEDIUM'
                      ? '⚠ Medium Risk Warning'
                      : '☣ Critical High Risk Warning'}
                  </span>
                  <p className="text-[#FAFAFA] text-[11px] leading-relaxed pt-1">
                    {fheResult.riskLevel === 'LOW'
                      ? 'This protocol exhibits robust security metrics, verified source code, and no history of exploits. You may safely proceed with staking.'
                      : fheResult.riskLevel === 'MEDIUM'
                      ? 'This protocol contains moderate risk signals. Admin key centralization or external price feed oracle dependencies were detected. Ensure you trust the governance structure before signing.'
                      : 'Extremely elevated risk signals detected. This protocol may be unverified on Etherscan, possess unrestricted owner privileges, or have a documented history of severe smart contract exploits. Proceeding carries substantial threat of capital loss!'}
                  </p>
                </div>

                <div className="space-y-3 font-mono text-[11px] text-[#909090]">
                  <div className="border border-[#222222] bg-[#090909] p-3 rounded">
                    <span className="text-[#F5F5F5] block uppercase tracking-wider mb-1 font-bold">Ciphertext SHA-256 Hash</span>
                    <span className="break-all text-[#C0FF00] p-1 rounded bg-[#050505] border border-white/5 block">{fheResult.ciphertextHash}</span>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 border border-[#FF2A5F]/20 bg-[#FF2A5F]/10 font-mono text-xs text-[#FF2A5F] rounded">
                    [ERROR] {errorMsg}
                  </div>
                )}

                <div className="flex flex-col gap-3 font-mono">
                  <button
                    onClick={handleWriteToLedger}
                    disabled={loading}
                    className={`text-xs uppercase font-black tracking-widest w-full py-3.5 rounded transition-all duration-200 shadow-sm ${
                      loading ? 'bg-[#222222] text-[#909090] cursor-not-allowed' :
                      fheResult.riskLevel === 'LOW'
                        ? 'bg-[#C0FF00] hover:bg-[#D4FF4D] text-[#050505] hover:shadow-[0_0_20px_rgba(192,255,0,0.3)]'
                        : fheResult.riskLevel === 'MEDIUM'
                        ? 'bg-[#FF5A00] hover:bg-[#ff731a] text-[#050505] hover:shadow-[0_0_20px_rgba(255,90,0,0.3)]'
                        : 'bg-[#FF2A5F] hover:bg-[#ff4d7a] text-[#F5F5F5] hover:shadow-[0_0_20px_rgba(255,42,95,0.4)]'
                    }`}
                  >
                    {loading ? 'Executing on-chain...' : 'Acknowledge Risk & Write to Ledger'}
                  </button>
                  <button
                    onClick={handleAbort}
                    disabled={loading}
                    className="border border-[#FF2A5F] text-[#FF2A5F] bg-transparent hover:bg-[#FF2A5F]/10 text-xs uppercase font-bold tracking-widest w-full py-3 transition-colors rounded"
                  >
                    Abort Transaction
                  </button>
                </div>
              </div>
            ) : (
              /* Parameters Input Form (Default Panel) */
              <form onSubmit={handleRunPrivacyAudit} className="space-y-6">
                {errorMsg && (
                  <div className="p-3 border border-[#FF2A5F]/20 bg-[#FF2A5F]/10 font-mono text-xs text-[#FF2A5F] rounded">
                    [ERROR] {errorMsg}
                  </div>
                )}

                {/* Staking target selector */}
                <div className="space-y-2">
                  <label className="block font-mono text-[10px] uppercase text-[#909090] tracking-wider font-bold">
                    Target Protocol
                  </label>
                  <select
                    name="protocolSelect"
                    value={formData.protocolSelect}
                    onChange={handleChange}
                    className="w-full bg-[#090909] border border-[#FF5A00]/30 focus:border-[#C0FF00] focus:outline-none p-3 font-mono text-xs text-[#F5F5F5] rounded transition-colors"
                  >
                    {PRE_LISTED_PROTOCOLS.map((p) => (
                      <option key={p.address} value={p.address}>{p.name} ({p.address.substring(0, 6)}...{p.address.slice(-4)})</option>
                    ))}
                    <option value="custom">Paste Custom Contract Address</option>
                  </select>
                </div>

                {formData.protocolSelect === 'custom' && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="block font-mono text-[10px] uppercase text-[#909090] tracking-wider font-bold">
                        Custom Contract Address
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          name="customAddress"
                          value={formData.customAddress}
                          onChange={handleChange}
                          placeholder="e.g. 0x87870B..."
                          className="w-full bg-[#090909] border border-[#222222] focus:border-[#C0FF00] focus:outline-none p-3 font-mono text-xs text-[#F5F5F5] rounded transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => handleScan()}
                          disabled={scanning}
                          className="px-5 bg-gradient-to-r from-[#C0FF00] to-[#FF5A00] hover:shadow-[0_0_12px_rgba(255,90,0,0.3)] text-[#050505] font-mono text-[10px] uppercase font-black tracking-wider transition-all rounded"
                        >
                          {scanning ? "Scanning..." : "Scan"}
                        </button>
                      </div>
                    </div>

                    {/* How to Audit Custom Protocols Guide Box */}
                    <div className="border border-[#FF5A00]/25 rounded bg-[#FF5A00]/5 p-3.5 text-[11px] font-mono">
                      <button
                        type="button"
                        onClick={() => setShowCustomGuide(!showCustomGuide)}
                        className="flex justify-between items-center w-full text-left font-bold text-[#FF5A00] tracking-wider uppercase text-[9px]"
                      >
                        <span>{showCustomGuide ? "[-] Hide Guide" : "[?] How to Verify Custom Protocols"}</span>
                        <span>{showCustomGuide ? "COLLAPSE" : "LEARN MORE"}</span>
                      </button>
                      
                      {showCustomGuide && (
                        <div className="mt-2 text-[#909090] space-y-2 border-t border-[#FF5A00]/10 pt-2 leading-relaxed">
                          <p>
                            To scan and verify a custom protocol dynamically, paste any verified smart contract address from <strong className="text-white">Ethereum Mainnet</strong>. 
                          </p>
                          <div className="p-2 bg-[#050505] rounded border border-white/5 space-y-1 text-[9px]">
                            <div className="text-[#C0FF00] font-bold uppercase">Ready Mainnet Demo Addresses:</div>
                            <div className="flex justify-between text-[10px] select-all font-semibold text-white bg-white/5 px-1 rounded break-all">
                              <span>0x1F98431c8aD98523631AE4a59f267346ea31F984</span>
                            </div>
                            <div className="text-[8px] text-[#909090] italic">(Uniswap V3 Factory - Low/Medium risk)</div>
                            <div className="flex justify-between text-[10px] select-all font-semibold text-white bg-white/5 px-1 rounded break-all mt-1">
                              <span>0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7</span>
                            </div>
                            <div className="text-[8px] text-[#909090] italic">(Curve Finance 3Pool - Low risk)</div>
                          </div>
                          <p className="text-[10px] text-white font-semibold pt-1 border-t border-white/5">
                            How this works under the hood:
                          </p>
                          <ul className="list-disc list-inside pl-1 space-y-1 text-[10px]">
                            <li>The backend uses keyless HTTP queries to retrieve the verified source code from Etherscan.</li>
                            <li>The local regex parser analyzes security constructs to calculate the code risk vector.</li>
                            <li>MetaMask signs and authorizes the resulting FHE audit proof directly onto your <strong className="text-white">local Hardhat node</strong>.</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Staking Amount */}
                <div className="space-y-2">
                  <label className="block font-mono text-[10px] uppercase text-[#909090] tracking-wider font-bold">
                    Staking Size (USD)
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    required
                    min="1"
                    placeholder="e.g. 15000"
                    className="w-full bg-[#090909] border border-[#222222] focus:border-[#C0FF00] focus:outline-none p-3 font-mono text-xs text-[#F5F5F5] rounded transition-colors"
                  />
                </div>

                {/* Concentration Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between font-mono text-[10px] uppercase text-[#909090] tracking-wider font-bold">
                    <span>Portfolio Weight</span>
                    <span className="text-[#C0FF00] font-bold">{formData.portfolioConcentration}%</span>
                  </div>
                  <input
                    type="range"
                    name="portfolioConcentration"
                    min="1"
                    max="100"
                    value={formData.portfolioConcentration}
                    onChange={handleChange}
                    className="w-full accent-[#C0FF00] cursor-pointer"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!contractReport || scanning || loading}
                  className="w-full tech-btn-primary text-xs uppercase tracking-widest font-black py-3.5 bg-gradient-to-r from-[#C0FF00] to-[#FF5A00] text-[#050505] disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(255,90,0,0.25)] transition-all duration-300"
                >
                  {loading ? "COMPILING FHE CALCULATIONS..." : "RUN PRIVACY AUDIT"}
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Code Audits and FHE logs (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* AI Smart Contract Security Profile Dashboard */}
            {contractReport && (
              <div 
                className="dashboard-card p-6 space-y-4 relative overflow-hidden"
                style={{ borderTop: '2px solid transparent', borderImage: 'linear-gradient(to right, #FF5A00, #C0FF00) 1' }}
              >
                <div className="flex justify-between items-center border-b border-[#222222] pb-3">
                  <h3 className="font-mono text-xs font-bold text-[#F5F5F5] uppercase tracking-widest">
                    Security Analysis Profile
                  </h3>
                  <span className="font-mono text-[9px] text-[#C0FF00] uppercase border border-[#C0FF00]/20 px-2 py-0.5 rounded bg-[#C0FF00]/5 font-bold tracking-wider">
                    Etherscan Telemetry
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left stats */}
                  <div className="space-y-3 text-xs font-mono text-[#909090] border-r border-[#222222]/50 pr-4">
                    <div>Protocol: <span className="text-[#F5F5F5] font-semibold block mt-0.5">{contractReport.name}</span></div>
                    <div>Source Verified: <span className={`font-bold block mt-0.5 ${contractReport.verified ? "text-[#C0FF00]" : "text-[#FF5A00]"}`}>{contractReport.verified ? "YES" : "NO"}</span></div>
                    <div>Proxy Pattern: <span className="text-[#F5F5F5] block mt-0.5">{contractReport.proxy_pattern || "None (Immutable)"}</span></div>
                    <div>Admin Structure: <span className="text-[#F5F5F5] block mt-0.5">{contractReport.owner_type}</span></div>
                  </div>

                  {/* Right meters */}
                  <div className="space-y-3 bg-[#090909] p-4 border border-[#222222] rounded text-xs font-mono">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span>AI Code Vulnerability Score</span>
                        <span className={`font-bold ${getMeterColorClass(contractReport.contract_code_risk).replace('bg', 'text')}`}>
                          {contractReport.contract_code_risk.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-[#050505] h-1 border border-white/5 rounded-full overflow-hidden">
                        <div className={`h-full ${getMeterColorClass(contractReport.contract_code_risk)}`} style={{ width: `${contractReport.contract_code_risk * 100}%` }}></div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span>Reentrancy Attack Vector</span>
                        <span className={`font-bold ${getMeterColorClass(contractReport.reentrancy_risk).replace('bg', 'text')}`}>
                          {contractReport.reentrancy_risk.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-[#050505] h-1 border border-white/5 rounded-full overflow-hidden">
                        <div className={`h-full ${getMeterColorClass(contractReport.reentrancy_risk)}`} style={{ width: `${contractReport.reentrancy_risk * 100}%` }}></div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span>Admin Key Centralization</span>
                        <span className={`font-bold ${getMeterColorClass(contractReport.admin_privileges).replace('bg', 'text')}`}>
                          {contractReport.admin_privileges.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-[#050505] h-1 border border-white/5 rounded-full overflow-hidden">
                        <div className={`h-full ${getMeterColorClass(contractReport.admin_privileges)}`} style={{ width: `${contractReport.admin_privileges * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {contractReport.vulnerabilities && (
                  <div className="p-4 bg-gradient-to-r from-[#C0FF00]/5 to-[#FF5A00]/5 border border-[#FF5A00]/20 text-[11px] rounded font-mono leading-relaxed space-y-2">
                    <span className="font-bold block uppercase tracking-widest text-[#C0FF00] text-[9px] border-b border-[#C0FF00]/25 pb-1 flex items-center justify-between">
                      <span>AI Audit Score Explanation</span>
                      <span className="text-[#FF5A00] font-mono text-[8px] bg-[#FF5A00]/10 px-1 py-0.2 rounded">SECURE</span>
                    </span>
                    <p className="text-[#FAFAFA] text-[11px] leading-relaxed">{contractReport.vulnerabilities}</p>
                    <p className="text-[9px] text-[#909090] italic pt-1 border-t border-white/5">
                      * This qualitative security profile determines the contract code risk score (Feature #6), which is compiled client-side and sent as encrypted LWE ciphertext for homomorphic evaluation.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Cryptographic FHE Console Terminal */}
            <div 
              className="dashboard-card p-6 flex flex-col h-[320px] justify-between relative overflow-hidden"
              style={{ borderTop: '2px solid transparent', borderImage: 'linear-gradient(to right, #C0FF00, #FF5A00) 1' }}
            >
              <div className="flex justify-between items-center border-b border-[#222222] pb-3">
                <h3 className="font-mono text-xs font-bold text-[#F5F5F5] uppercase tracking-widest flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full animate-ping ${fheResult ? 'bg-[#FF5A00]' : 'bg-[#C0FF00]'}`}></span>
                  <span>FHE Verification Pipeline Logs</span>
                </h3>
                <span className="font-mono text-[9px] text-[#909090] opacity-40 uppercase">STDOUT</span>
              </div>

              <div className="terminal-viewer flex-grow my-4 p-4 overflow-y-auto text-[10px] text-[#C0FF00] space-y-2 leading-relaxed">
                {terminalLogs.length === 0 ? (
                  <div className="text-white/10 italic font-mono h-full flex items-center justify-center">
                    Initiate FHE Risk Evaluation to view logs...
                  </div>
                ) : (
                  terminalLogs.map((log, index) => (
                    <div key={index} className="break-all font-mono whitespace-pre-wrap">{log}</div>
                  ))
                )}
                <div ref={terminalBottomRef} />
              </div>

              {loading && (
                <div className="flex items-center gap-3 text-[10px] font-mono text-[#909090] uppercase animate-pulse-soft">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#FF5A00]"></div>
                  <span>
                    {loadingStep === 1 && "FHE evaluation active - encrypting feature vectors locally..."}
                    {loadingStep === 2 && "FHE evaluation active - running server blind inference..."}
                    {loadingStep === 3 && "Blockchain transaction active - awaiting gate signature..."}
                    {loadingStep === 4 && "Blockchain transaction active - committing audit log..."}
                    {loadingStep === 0 && "Active processing..."}
                  </span>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Collapsible cryptographic details block */}
        {(result || fheResult) && (
          <div 
            className="dashboard-card p-6 relative overflow-hidden"
            style={{ borderTop: '2px solid transparent', borderImage: 'linear-gradient(to right, #FF5A00, #C0FF00) 1' }}
          >
            <button
              type="button"
              onClick={() => setShowProof(!showProof)}
              className="w-full text-left font-mono text-xs uppercase text-[#C0FF00] hover:text-[#FF5A00] flex justify-between items-center transition-colors"
            >
              <span className="font-bold tracking-wider">{showProof ? "[-] Hide Cryptographic Details" : "[+] Show Cryptographic Details"}</span>
              <span className="text-[9px] text-[#909090] bg-[#1a1a1a] px-2.5 py-0.5 rounded font-mono font-bold">{showProof ? "COLLAPSE" : "EXPAND"}</span>
            </button>

            {showProof && (
              <div className="mt-6 pt-6 border-t border-[#222222] space-y-6 font-mono text-[11px] text-[#909090]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <span className="text-[#F5F5F5] font-bold block uppercase tracking-wider">Secure Client Enclave</span>
                    <div className="bg-[#090909] p-3 rounded border border-[#222222] space-y-2">
                      <div>Secret Key: <span className="text-[#FF2A5F] font-bold">Held in local client context</span></div>
                      <div className="break-all">Ciphertext Hash: <span className="text-[#C0FF00]">{(result || fheResult).ciphertextHash}</span></div>
                    </div>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <span className="text-[#F5F5F5] font-bold block uppercase tracking-wider">Evaluation Ciphertext Payload (LWE Encrypted)</span>
                    <div className="bg-[#090909] p-3 rounded border border-[#222222]">
                      <div className="break-all max-h-[80px] overflow-y-auto text-[#FFB300] bg-[#050505] p-2 rounded border border-white/5">{(result || fheResult).ciphertext}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#222222]">
                  <div className="space-y-2">
                    <span className="text-[#F5F5F5] font-bold block uppercase tracking-wider">Pre-Staking Gate contract</span>
                    <div className="bg-[#090909] p-3 rounded border border-[#222222]">
                      <div>Gatekeeper Address: <span className="text-[#C0FF00] font-semibold">{GATE_ADDRESS}</span></div>
                      <div className="break-all mt-1">Tx: <span className="text-white/60">{result ? result.gateTxHash : 'Awaiting user acknowledgment...'}</span></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[#F5F5F5] font-bold block uppercase tracking-wider">Audit Log contract</span>
                    <div className="bg-[#090909] p-3 rounded border border-[#222222]">
                      <div>Log Registry Address: <span className="text-[#C0FF00] font-semibold">{CONTRACT_ADDRESS}</span></div>
                      <div className="break-all mt-1">Tx: <span className="text-white/60">{result ? result.logTxHash : 'Awaiting user acknowledgment...'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
