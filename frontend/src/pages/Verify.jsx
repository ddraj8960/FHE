import React, { useState } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';

// Setup local endpoints and contract ABI details
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const CLIENT_DAEMON_URL = 'http://localhost:5001';
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

// ABI for RiskLog.sol contract
const CONTRACT_ABI = [
  "function createLog(bytes32 payloadHash, string memory riskLevel) external",
  "function logCount() external view returns (uint256)",
  "function getLog(uint256 id) external view returns (tuple(address wallet, bytes32 payloadHash, string riskLevel, uint256 timestamp))"
];

// Helper merchant risk mappings
const MERCHANT_RISK_MAP = {
  "Groceries": 0.1,
  "Retail": 0.3,
  "Entertainment": 0.5,
  "Travel": 0.6,
  "Electronics": 0.8,
  "Cash Withdrawal": 0.9
};

export default function Verify({ walletAddress, connectWallet }) {
  const [formData, setFormData] = useState({
    amount: '',
    merchantCategory: 'Groceries',
    deviceTrust: 95,
    txFrequency: 2,
    locationRisk: 10
  });

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0); // 1: Encrypting, 2: FHE Inference, 3: Blockchain Write
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState(null);
  const [showProof, setShowProof] = useState(false);

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

    setLoading(true);
    setErrorMsg('');
    setResult(null);

    try {
      // Step 1: Normalize inputs and Encrypt locally via Client Daemon
      setLoadingStep(1);
      
      // Feature normalization
      const amt = parseFloat(formData.amount) || 0;
      const amountNormalized = Math.min(amt / 10000, 1.0); // Normalize relative to 10k max
      const merchantRisk = MERCHANT_RISK_MAP[formData.merchantCategory] || 0.3;
      const deviceTrustRisk = (100 - (parseFloat(formData.deviceTrust) || 0)) / 100; // Invert trust so high trust = low risk
      const txFreqNormalized = Math.min((parseFloat(formData.txFrequency) || 0) / 50, 1.0); // Normalize relative to 50 max
      const locRiskNormalized = (parseFloat(formData.locationRisk) || 0) / 100;

      const features = [
        amountNormalized,
        merchantRisk,
        deviceTrustRisk,
        txFreqNormalized,
        locRiskNormalized
      ];

      // Request local daemon to encrypt inputs
      const encryptRes = await axios.post(`${CLIENT_DAEMON_URL}/api/client/encrypt`, {
        features: features
      });

      const { ciphertext, eval_key, ciphertext_hash } = encryptRes.data;

      // Step 2: Server-side homomorphic inference
      setLoadingStep(2);

      // Bucketing exact amount for db entry
      let amountRange = "Under 100";
      if (amt >= 100 && amt < 500) amountRange = "100-500";
      else if (amt >= 500 && amt < 2000) amountRange = "500-2000";
      else if (amt >= 2000) amountRange = "Over 2000";

      // POST to backend API (the server NEVER sees plaintext features)
      const verifyRes = await axios.post(`${BACKEND_URL}/api/verify`, {
        ciphertext: ciphertext,
        eval_key: eval_key,
        wallet_address: walletAddress,
        amount_range: amountRange,
        merchant_category: formData.merchantCategory
      });

      const { encrypted_result, id: verificationId } = verifyRes.data;

      // Decrypt locally using the daemon
      const decryptRes = await axios.post(`${CLIENT_DAEMON_URL}/api/client/decrypt`, {
        encrypted_result: encrypted_result
      });

      const { prediction } = decryptRes.data;
      const riskMapping = { 0: "LOW", 1: "MEDIUM", 2: "HIGH" };
      const finalRiskLevel = riskMapping[prediction] || "MEDIUM";

      // Step 3: Write to Blockchain (Polygon Amoy)
      setLoadingStep(3);

      if (!window.ethereum) {
        throw new Error("MetaMask is not installed. Unable to write audit trail to blockchain.");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Initialize contract instance
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      // Hardhat expects bytes32 payload hash
      // The local daemon outputs SHA256 of ciphertext. We ensure it is formatted as a hex string with '0x' prefix
      let hexHash = ciphertext_hash.startsWith('0x') ? ciphertext_hash : `0x${ciphertext_hash}`;
      
      // Invoke Solidity contract createLog function
      const tx = await contract.createLog(hexHash, finalRiskLevel);
      
      // Wait for blockchain confirmation
      const receipt = await tx.wait();

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
        txHash: receipt.hash,
        normalizedFeatures: features,
        ciphertext: ciphertext,
        evalKey: eval_key
      });

    } catch (err) {
      console.error(err);
      let errMsg = "An error occurred during verification.";
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errMsg = err.response.data.detail;
        } else {
          errMsg = JSON.stringify(err.response.data.detail);
        }
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
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="border border-[#152219] bg-[#0F1A16] p-6 glow-teal">
        <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-[#00D4AA] border-b border-[#152219] pb-3 mb-6 flex items-center justify-between">
          <span>Verification Console</span>
          <span className="text-[10px] text-[#7FB89A]">Terminal ID: SEC-7700</span>
        </h2>

        {!walletAddress ? (
          <div className="text-center py-8">
            <p className="text-[#7FB89A] text-sm font-mono mb-4 uppercase">Secure wallet connection required</p>
            <button
              onClick={connectWallet}
              className="font-mono text-xs uppercase px-4 py-2 border border-[#00D4AA] text-[#00D4AA] hover:bg-[#00D4AA]/10 transition-colors duration-200"
            >
              Connect Wallet
            </button>
          </div>
        ) : loading ? (
          /* Knox Step Progress Bar & Spinner */
          <div className="py-12 flex flex-col items-center">
            {/* Spinning encryption brackets */}
            <div className="relative w-16 h-16 mb-8 flex items-center justify-center">
              <div className="absolute inset-0 border border-[#00D4AA] rounded-full animate-spin-slow border-t-transparent border-b-transparent"></div>
              <span className="font-mono text-xs text-[#00D4AA] animate-pulse-soft">&lt;FHE&gt;</span>
            </div>

            {/* 3-Step Progress indicator */}
            <div className="w-full max-w-sm space-y-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className={loadingStep >= 1 ? "text-[#00D4AA]" : "text-[#152219]"}>1. ENCRYPTING</span>
                <span className={loadingStep >= 2 ? "text-[#00D4AA]" : "text-[#152219]"}>&gt;&gt;</span>
                <span className={loadingStep >= 2 ? "text-[#00D4AA]" : "text-[#152219]"}>2. INFERENCE</span>
                <span className={loadingStep >= 3 ? "text-[#00D4AA]" : "text-[#152219]"}>&gt;&gt;</span>
                <span className={loadingStep >= 3 ? "text-[#00D4AA]" : "text-[#152219]"}>3. ON-CHAIN</span>
              </div>
              <div className="w-full bg-[#0A0F0D] h-2 border border-[#152219] p-[1px]">
                <div
                  className="bg-[#00D4AA] h-full transition-all duration-500"
                  style={{ width: `${(loadingStep / 3) * 100}%` }}
                ></div>
              </div>
              <p className="text-center font-mono text-xs text-[#7FB89A] uppercase tracking-wide">
                {loadingStep === 1 && "Client-side FHE key generation & input encryption..."}
                {loadingStep === 2 && "Executing homomorphic risk inference on encrypted inputs..."}
                {loadingStep === 3 && "Broadcasting SHA256 audit hash to Polygon Amoy..."}
              </p>
            </div>
          </div>
        ) : result ? (
          /* Verification Success screen */
          <div className="space-y-6">
            <div className="p-4 border border-[#152219] bg-[#0A0F0D] text-center">
              <div className="font-mono text-xs text-[#7FB89A] uppercase mb-2">RISK EVALUATION LOGGED</div>
              <span
                className={`font-mono text-2xl font-bold tracking-widest px-4 py-1 border ${
                  result.riskLevel === 'LOW'
                    ? 'border-[#00D4AA] text-[#00D4AA]'
                    : result.riskLevel === 'MEDIUM'
                    ? 'border-[#FFA502] text-[#FFA502]'
                    : 'border-[#FF4757] text-[#FF4757]'
                }`}
              >
                {result.riskLevel}
              </span>
            </div>

            {/* Audit hashes */}
            <div className="space-y-3 font-mono text-xs text-[#7FB89A]">
              <div className="border border-[#152219] bg-[#0A0F0D]/60 p-3">
                <span className="text-[#E8F5F0] block mb-1">CIPHERTEXT SHA-256 HASH (ON-CHAIN)</span>
                <span className="break-all text-[11px] text-[#00D4AA]">{result.ciphertextHash}</span>
              </div>

              <div className="border border-[#152219] bg-[#0A0F0D]/60 p-3">
                <span className="text-[#E8F5F0] block mb-1">POLYGON AMOY TX HASH</span>
                <a
                  href={`https://amoy.polygonscan.com/tx/${result.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-[11px] text-[#00D4AA] hover:underline"
                >
                  {result.txHash}
                </a>
              </div>
            </div>

            {/* Toggle technical details */}
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
                    <span className="text-[#E8F5F0] block font-bold mb-1">1. CLIENT-SIDE NORMALIZATION & LOCAL FHE ENCRYPTION</span>
                    <div className="bg-[#050A08] p-2.5 border border-[#152219] space-y-1 text-xs">
                      <div>Raw Inputs: <span className="text-[#00D4AA]">Amt: ${formData.amount}, Category: {formData.merchantCategory}, Trust: {formData.deviceTrust}%, Freq: {formData.txFrequency}, Loc: {formData.locationRisk}%</span></div>
                      <div>Plaintext Feature Vector: <span className="text-[#00D4AA]">{JSON.stringify(result.normalizedFeatures)}</span></div>
                      <div className="break-all">FHE Private Key: <span className="text-[#7FB89A] italic">[Generated locally & kept in client memory]</span></div>
                      <div className="break-all text-ellipsis overflow-hidden">FHE Evaluation Key (Truncated): <span className="text-[#FFA502]">{result.evalKey ? result.evalKey.substring(0, 40) + "..." : "N/A"}</span> ({Math.round((result.evalKey?.length || 0)/2/1024)} KB)</div>
                      <div className="break-all text-ellipsis overflow-hidden">FHE Ciphertext (Truncated): <span className="text-[#FFA502]">{result.ciphertext ? result.ciphertext.substring(0, 40) + "..." : "N/A"}</span> ({Math.round((result.ciphertext?.length || 0)/2/1024)} KB)</div>
                      <div className="break-all">Ciphertext Payload Hash (SHA256): <span className="text-[#00D4AA]">{result.ciphertextHash}</span></div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[#E8F5F0] block font-bold mb-1">2. SERVER-SIDE HOMOMORPHIC INFERENCE (ZERO-KNOWLEDGE)</span>
                    <div className="bg-[#050A08] p-2.5 border border-[#152219] space-y-1 text-xs">
                      <div>Server API Endpoint: <span className="text-[#00D4AA]">{BACKEND_URL}/api/verify</span></div>
                      <div>Evaluation Status: <span className="text-[#00D4AA]">Success</span></div>
                      <div>Decryption Key on Server: <span className="text-[#FF4757] font-bold">ABSENT (Server operates blindly on encrypted bytes)</span></div>
                      <div>Homomorphic Operation: <span className="text-[#7FB89A]">Quantized Logistic Regression Inference (n_bits=6)</span></div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[#E8F5F0] block font-bold mb-1">3. LOCAL DECRYPTION & DECISION CLASS MAPPING</span>
                    <div className="bg-[#050A08] p-2.5 border border-[#152219] space-y-1 text-xs">
                      <div>Client Daemon: <span className="text-[#00D4AA]">http://localhost:5001/api/client/decrypt</span></div>
                      <div>Decrypted Class Prediction: <span className="text-[#00D4AA]">{result.riskLevel}</span></div>
                      <div className="text-[10px] text-[#7FB89A] italic">* Only the client machine (with the private key) can read the model output score.</div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[#E8F5F0] block font-bold mb-1">4. IMMUTABLE ON-CHAIN AUDIT LOG</span>
                    <div className="bg-[#050A08] p-2.5 border border-[#152219] space-y-1 text-xs">
                      <div>Contract Address: <span className="text-[#00D4AA]">{CONTRACT_ADDRESS}</span></div>
                      <div>Emitted Event: <span className="text-[#00D4AA]">LogCreated(indexed wallet, bytes32 payloadHash, string riskLevel)</span></div>
                      <div className="break-all">Transaction Hash: <span className="text-[#00D4AA]">{result.txHash}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setResult(null)}
                className="w-full font-mono text-xs uppercase py-3 border border-[#00D4AA] text-[#0A0F0D] bg-[#00D4AA] hover:bg-[#33E0BB] hover:border-[#33E0BB] transition-colors duration-200"
              >
                New Verification
              </button>
            </div>
          </div>
        ) : (
          /* Verification Form */
          <form onSubmit={handleVerify} className="space-y-4">
            {errorMsg && (
              <div className="p-3 border border-[#FF4757] bg-[#FF4757]/10 font-mono text-xs text-[#FF4757]">
                [ERROR] {errorMsg}
              </div>
            )}

            {/* Transaction Amount */}
            <div>
              <label className="block font-mono text-xs uppercase text-[#7FB89A] mb-1.5">
                Transaction Amount (USD)
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="0.01"
                step="0.01"
                placeholder="e.g. 250.00"
                className="w-full bg-[#0A0F0D] border border-[#152219] focus:border-[#00D4AA] focus:outline-none p-2.5 font-mono text-sm text-[#E8F5F0]"
              />
            </div>

            {/* Merchant Category */}
            <div>
              <label className="block font-mono text-xs uppercase text-[#7FB89A] mb-1.5">
                Merchant Category
              </label>
              <select
                name="merchantCategory"
                value={formData.merchantCategory}
                onChange={handleChange}
                className="w-full bg-[#0A0F0D] border border-[#152219] focus:border-[#00D4AA] focus:outline-none p-2.5 font-mono text-sm text-[#E8F5F0]"
              >
                <option value="Groceries">Groceries (Low Risk)</option>
                <option value="Retail">Retail (Low-Med Risk)</option>
                <option value="Entertainment">Entertainment (Medium Risk)</option>
                <option value="Travel">Travel (Med-High Risk)</option>
                <option value="Electronics">Electronics (High Risk)</option>
                <option value="Cash Withdrawal">Cash Withdrawal (Very High Risk)</option>
              </select>
            </div>

            {/* Device Trust Slider */}
            <div>
              <div className="flex justify-between font-mono text-xs uppercase text-[#7FB89A] mb-1">
                <span>Device Trust Score</span>
                <span className="text-[#00D4AA]">{formData.deviceTrust}%</span>
              </div>
              <input
                type="range"
                name="deviceTrust"
                min="0"
                max="100"
                value={formData.deviceTrust}
                onChange={handleChange}
                className="w-full accent-[#00D4AA]"
              />
            </div>

            {/* Tx Frequency */}
            <div>
              <label className="block font-mono text-xs uppercase text-[#7FB89A] mb-1.5">
                Tx Frequency (Past 24 Hours)
              </label>
              <input
                type="number"
                name="txFrequency"
                value={formData.txFrequency}
                onChange={handleChange}
                required
                min="1"
                className="w-full bg-[#0A0F0D] border border-[#152219] focus:border-[#00D4AA] focus:outline-none p-2.5 font-mono text-sm text-[#E8F5F0]"
              />
            </div>

            {/* Location Risk Slider */}
            <div>
              <div className="flex justify-between font-mono text-xs uppercase text-[#7FB89A] mb-1">
                <span>Location Risk Score</span>
                <span className="text-[#00D4AA]">{formData.locationRisk}%</span>
              </div>
              <input
                type="range"
                name="locationRisk"
                min="0"
                max="100"
                value={formData.locationRisk}
                onChange={handleChange}
                className="w-full accent-[#00D4AA]"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full font-mono text-xs uppercase py-3 border border-[#00D4AA] text-[#0A0F0D] bg-[#00D4AA] hover:bg-[#33E0BB] hover:border-[#33E0BB] transition-colors duration-200 glow-teal hover:glow-teal-strong mt-6"
            >
              Encrypt & Verify Transaction
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
