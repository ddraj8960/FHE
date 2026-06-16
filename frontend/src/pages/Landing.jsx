import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing({ walletAddress, connectWallet }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 scanlines">
      {/* Knox Technical Header Panel */}
      <div className="border border-[#152219] bg-[#0F1A16] p-6 mb-8 relative glow-teal">
        <div className="absolute top-0 right-4 transform -translate-y-1/2 bg-[#0A0F0D] border border-[#152219] px-3 py-0.5 font-mono text-[10px] text-[#00D4AA] uppercase tracking-widest">
          SYSTEM STATUS: ACTIVE
        </div>
        
        {/* Terminal Text Banner */}
        <pre className="font-mono text-[9px] sm:text-xs text-[#00D4AA] leading-none mb-6 overflow-x-auto">
{` _  _  __   __   __   ____  ____  ____  _  _  __  ____  __   ____ 
( \\/ )/ _\\ (  ) (  ) (  __)(_  _)/ ___)/ )( \\(  )(  __)(  ) (    \\
/ \\/ \\/    \\/ (_// (_/\\)__)   )(  \\___ \\) __ ( )(  )__) / (_/\\) D (
\\_)(_/\\_/\\_/\\____/\\____/(____) (__) (____/\\_)(_/(__)(____)\\____/(____/`}
        </pre>
        
        <h1 className="text-xl sm:text-2xl font-bold font-mono text-[#E8F5F0] mb-3 uppercase tracking-wider">
          Privacy-Preserving DeFi Pre-Staking Risk Assessment
        </h1>
        <p className="text-[#7FB89A] text-sm sm:text-base leading-relaxed mb-6">
          Traditional DeFi analytics expose plaintext staking intent (investment amounts, target protocols, portfolio concentrations) to risk-scoring servers. 
          WalletShield secures your private strategy by performing homomorphic machine learning inference on client-encrypted inputs. The server scores protocol risk without ever decrypting or seeing your raw parameters.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 border-t border-[#152219]/60 pt-6">
          {walletAddress ? (
            <Link
              to="/verify"
              className="inline-block text-center font-mono text-xs uppercase px-6 py-3 border border-[#00D4AA] text-[#0A0F0D] bg-[#00D4AA] hover:bg-[#33E0BB] hover:border-[#33E0BB] transition-colors duration-200 glow-teal"
            >
              Initialize Verification Flow &gt;
            </Link>
          ) : (
            <button
              onClick={connectWallet}
              className="font-mono text-xs uppercase px-6 py-3 border border-[#00D4AA] text-[#00D4AA] hover:bg-[#00D4AA]/10 transition-colors duration-200"
            >
              Connect MetaMask to Begin
            </button>
          )}
          <Link
            to="/history"
            className="inline-block text-center font-mono text-xs uppercase px-6 py-3 border border-[#152219] text-[#7FB89A] bg-transparent hover:text-[#E8F5F0] hover:border-[#7FB89A]/30 transition-colors duration-200"
          >
            Access Audit Ledger
          </Link>
        </div>
      </div>

      {/* 3-Step Flow Diagram (Knox UI style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Step 1 */}
        <div className="border border-[#152219] bg-[#0F1A16]/50 p-5 rounded-sm">
          <div className="font-mono text-[#00D4AA] text-xs font-bold mb-2 uppercase tracking-wider">01 // Client Encrypt</div>
          <p className="text-xs text-[#7FB89A] leading-relaxed">
            Concrete ML model client parameters are loaded locally. Secret keys never leave your browser context. Staking parameters are encrypted client-side.
          </p>
        </div>
        {/* Step 2 */}
        <div className="border border-[#152219] bg-[#0F1A16]/50 p-5 rounded-sm">
          <div className="font-mono text-[#00D4AA] text-xs font-bold mb-2 uppercase tracking-wider">02 // Homomorphic Inference</div>
          <p className="text-xs text-[#7FB89A] leading-relaxed">
            The server evaluates a quantized logistic regression model directly on the ciphertext. Plaintext investment amounts, portfolio concentration, and scores are never revealed.
          </p>
        </div>
        {/* Step 3 */}
        <div className="border border-[#152219] bg-[#0F1A16]/50 p-5 rounded-sm">
          <div className="font-mono text-[#00D4AA] text-xs font-bold mb-2 uppercase tracking-wider">03 // On-Chain Verification</div>
          <p className="text-xs text-[#7FB89A] leading-relaxed">
            Upon local decryption, the user acknowledges the risk tier through an on-chain gate. An immutable, hashed audit log is written to the blockchain.
          </p>
        </div>
      </div>

      {/* Security Element Card */}
      <div className="border border-[#152219] bg-[#0F1A16] p-6">
        <h3 className="font-mono text-xs text-[#E8F5F0] uppercase tracking-widest mb-3 border-b border-[#152219] pb-2 flex items-center justify-between">
          <span>Cryptographic Specs</span>
          <span className="text-[10px] text-[#7FB89A]">FHE parameters</span>
        </h3>
        <table className="w-full text-xs font-mono text-[#7FB89A] leading-relaxed">
          <tbody>
            <tr>
              <td className="py-1 text-[#E8F5F0]">Compiler</td>
              <td className="py-1 text-right">Zama Concrete Compiler (via concrete-ml v1.9.0)</td>
            </tr>
            <tr>
              <td className="py-1 text-[#E8F5F0]">Model Architecture</td>
              <td className="py-1 text-right">Quantized Logistic Regression (6-bit)</td>
            </tr>
            <tr>
              <td className="py-1 text-[#E8F5F0]">On-chain Log Registry</td>
              <td className="py-1 text-right">On-Chain Pre-Tx Gates (Local Hardhat Node)</td>
            </tr>
            <tr>
              <td className="py-1 text-[#E8F5F0]">Client Encryption Daemon</td>
              <td className="py-1 text-right">Local secure element representative (Python 3.10)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
