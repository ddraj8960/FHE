import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing({ walletAddress, connectWallet }) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] cyber-grid py-12 px-4">
      <div className="relative max-w-5xl mx-auto space-y-8">
        
        {/* Main Dashboard Info Card */}
        <div className="dashboard-card p-8 sm:p-10 relative">
          <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-[#050505] border border-[#C0FF00]/30 px-3 py-1 font-mono text-[9px] text-[#C0FF00] uppercase tracking-wider rounded font-bold">
            AUDIT ENGINE ORACLE
          </div>

          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-[#C0FF00]/5 border border-[#C0FF00]/10 px-3 py-1 rounded text-xs font-mono text-[#C0FF00]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C0FF00]"></span>
              ZAMA FHE COMPILER INTEGRATED
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-[#F5F5F5] tracking-tight uppercase">
              Privacy-Preserving DeFi Pre-Staking Risk Analysis
            </h1>

            <p className="text-[#909090] text-sm sm:text-base leading-relaxed max-w-3xl">
              Traditional decentralized finance audit layers expose sensitive private intentions—such as asset staking amounts and personal asset weights—to risk scoring APIs. 
              WalletShield enforces secure risk compliance without leaking private parameters. Using **Fully Homomorphic Encryption (FHE)**, our scoring models execute on-chain validation gates blindly on encrypted payloads.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              {walletAddress ? (
                <Link
                  to="/verify"
                  className="tech-btn-primary inline-block text-center text-xs"
                >
                  START SECURE SCAN &gt;
                </Link>
              ) : (
                <button
                  onClick={connectWallet}
                  className="font-mono text-xs uppercase px-6 py-3.5 border border-[#C0FF00] text-[#C0FF00] hover:bg-[#C0FF00]/5 transition-all duration-200 font-bold tracking-widest rounded"
                >
                  Connect MetaMask
                </button>
              )}
              <Link
                to="/history"
                className="tech-btn-secondary inline-block text-center text-xs"
              >
                Access Ledger Logs
              </Link>
            </div>
          </div>
        </div>

        {/* 3-Step Process Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="dashboard-card p-6 dashboard-card-hover space-y-4">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <span className="font-mono text-xs text-[#C0FF00] font-bold tracking-wider uppercase">01 // Encryption</span>
              <span className="text-[9px] font-mono text-[#909090] uppercase">Client Context</span>
            </div>
            <h3 className="font-mono text-sm font-bold text-[#F5F5F5] uppercase tracking-wide">Client Parameters</h3>
            <p className="text-xs text-[#909090] leading-relaxed">
              Your investment capital size and portfolio allocation weights are converted to integers and encrypted locally via Zama Concrete ML. Private keys never leave your local environment.
            </p>
          </div>

          {/* Step 2 */}
          <div className="dashboard-card p-6 dashboard-card-hover space-y-4">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <span className="font-mono text-xs text-[#C0FF00] font-bold tracking-wider uppercase">02 // Blind Scoring</span>
              <span className="text-[9px] font-mono text-[#909090] uppercase">Server Context</span>
            </div>
            <h3 className="font-mono text-sm font-bold text-[#F5F5F5] uppercase tracking-wide">FHE Inference</h3>
            <p className="text-xs text-[#909090] leading-relaxed">
              The backend server executes homomorphic model inference on ciphertexts. Plaintext staking allocations, target addresses, and raw scores are never decrypted or exposed.
            </p>
          </div>

          {/* Step 3 */}
          <div className="dashboard-card p-6 dashboard-card-hover space-y-4">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <span className="font-mono text-xs text-[#C0FF00] font-bold tracking-wider uppercase">03 // Verification</span>
              <span className="text-[9px] font-mono text-[#909090] uppercase">On-Chain Gate</span>
            </div>
            <h3 className="font-mono text-sm font-bold text-[#F5F5F5] uppercase tracking-wide">PreTx Gatekeepers</h3>
            <p className="text-xs text-[#909090] leading-relaxed">
              The decrypted risk tier is verified on-chain via the PreTxGate smart contract. A cryptographic hash of the FHE ciphertext is logged as an immutable audit trail to RiskLog.
            </p>
          </div>
        </div>

        {/* Technical Specification Table */}
        <div className="dashboard-card p-6 sm:p-8">
          <div className="border-b border-[#222222] pb-3 mb-4 flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold text-[#F5F5F5] uppercase tracking-widest">
              Cryptographic Telemetry Specs
            </h3>
            <span className="h-2 w-2 rounded bg-[#C0FF00]"></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
            <div className="space-y-3">
              <div className="flex justify-between border-b border-[#222222] pb-2">
                <span className="text-[#909090] uppercase">FHE Compiler Framework</span>
                <span className="text-[#F5F5F5] font-semibold">Zama Concrete Compiler v2.10</span>
              </div>
              <div className="flex justify-between border-b border-[#222222] pb-2">
                <span className="text-[#909090] uppercase">Model Quantization</span>
                <span className="text-[#F5F5F5] font-semibold">6-Bit quantized linear layers</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#909090] uppercase">Assessed ML Model</span>
                <span className="text-[#F5F5F5] font-semibold">Logistic Regression (6 Features)</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between border-b border-[#222222] pb-2">
                <span className="text-[#909090] uppercase">On-Chain Enforcement Layer</span>
                <span className="text-[#F5F5F5] font-semibold">PreTxGate.sol Smart Contract</span>
              </div>
              <div className="flex justify-between border-b border-[#222222] pb-2">
                <span className="text-[#909090] uppercase">Ledger Proof Recording</span>
                <span className="text-[#F5F5F5] font-semibold">RiskLog.sol (Solidity 0.8.24)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#909090] uppercase">Audit Trail verification</span>
                <span className="text-[#F5F5F5] font-semibold">Ciphertext SHA-256 Hashes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
