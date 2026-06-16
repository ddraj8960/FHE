import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing({ walletAddress, connectWallet }) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] cyber-grid scanlines py-12 px-4">
      <div className="cyber-radial"></div>
      
      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Knox Technical Header Panel */}
        <div className="glass-panel p-6 sm:p-8 mb-8 relative glow-teal glow-border-pulse">
          <div className="absolute top-0 right-6 transform -translate-y-1/2 bg-[#040807] border border-[#00FFC4]/30 px-3 py-0.5 font-mono text-[10px] text-[#00FFC4] uppercase tracking-widest rounded-sm">
            SYSTEM STATUS: ACTIVE
          </div>
          
          {/* Terminal Text Banner */}
          <pre className="font-mono text-[9px] sm:text-xs text-[#00FFC4] leading-none mb-8 overflow-x-auto select-none opacity-85">
{` _  _  __   __   __   ____  ____  ____  _  _  __  ____  __   ____ 
( \\/ )/ _\\ (  ) (  ) (  __)(_  _)/ ___)/ )( \\(  )(  __)(  ) (    \\
/ \\/ \\/    \\/ (_// (_/\\)__)   )(  \\___ \\) __ ( )(  )__) / (_/\\) D (
\\_)(_/\\_/\\_/\\____/\\____/(____) (__) (____/\\_)(_/(__)(____)\\____/(____/`}
          </pre>
          
          <h1 className="text-2xl sm:text-3xl font-bold font-mono text-[#EBF7F2] mb-4 uppercase tracking-wider">
            Privacy-Preserving DeFi Pre-Staking Risk Assessment
          </h1>
          <p className="text-[#8EBF9F] text-sm sm:text-base leading-relaxed mb-8 max-w-3xl">
            Traditional DeFi analytics expose plaintext staking intent (investment amounts, target protocols, portfolio concentrations) to risk-scoring servers. 
            WalletShield secures your private strategy by performing homomorphic machine learning inference on client-encrypted inputs. The server scores protocol risk without ever decrypting or seeing your raw parameters.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 border-t border-white/5 pt-6">
            {walletAddress ? (
              <Link
                to="/verify"
                className="inline-block text-center font-mono text-xs uppercase px-6 py-3 border.5 border-[#00FFC4] text-[#040807] bg-[#00FFC4] hover:bg-[#66FFD9] hover:border-[#66FFD9] transition-all duration-300 font-bold tracking-widest shadow-[0_0_15px_rgba(0,255,196,0.25)] hover:shadow-[0_0_25px_rgba(0,255,196,0.45)]"
              >
                Initialize Verification Flow &gt;
              </Link>
            ) : (
              <button
                onClick={connectWallet}
                className="font-mono text-xs uppercase px-6 py-3 border border-[#00FFC4] text-[#00FFC4] hover:bg-[#00FFC4]/15 transition-all duration-300 font-bold tracking-widest shadow-[0_0_10px_rgba(0,255,196,0.1)]"
              >
                Connect MetaMask to Begin
              </button>
            )}
            <Link
              to="/history"
              className="inline-block text-center font-mono text-xs uppercase px-6 py-3 border border-white/10 text-[#8EBF9F] bg-transparent hover:text-[#EBF7F2] hover:border-[#00FFC4]/30 transition-all duration-300 rounded-sm"
            >
              Access Audit Ledger
            </Link>
          </div>
        </div>

        {/* 3-Step Flow Diagram (Knox UI style) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Step 1 */}
          <div className="glass-panel glass-panel-hover p-6 rounded-sm">
            <div className="font-mono text-[#00FFC4] text-xs font-bold mb-3 uppercase tracking-wider flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00FFC4] animate-pulse-soft"></span>
              <span>01 // Client Encrypt</span>
            </div>
            <p className="text-xs text-[#8EBF9F] leading-relaxed">
              Concrete ML model client parameters are loaded locally. Secret keys never leave your browser context. Staking parameters are encrypted client-side.
            </p>
          </div>
          {/* Step 2 */}
          <div className="glass-panel glass-panel-hover p-6 rounded-sm">
            <div className="font-mono text-[#00FFC4] text-xs font-bold mb-3 uppercase tracking-wider flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00FFC4] animate-pulse-soft"></span>
              <span>02 // Homomorphic Inference</span>
            </div>
            <p className="text-xs text-[#8EBF9F] leading-relaxed">
              The server evaluates a quantized logistic regression model directly on the ciphertext. Plaintext investment amounts, portfolio concentration, and scores are never revealed.
            </p>
          </div>
          {/* Step 3 */}
          <div className="glass-panel glass-panel-hover p-6 rounded-sm">
            <div className="font-mono text-[#00FFC4] text-xs font-bold mb-3 uppercase tracking-wider flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00FFC4] animate-pulse-soft"></span>
              <span>03 // On-Chain Verification</span>
            </div>
            <p className="text-xs text-[#8EBF9F] leading-relaxed">
              Upon local decryption, the user acknowledges the risk tier through an on-chain gate. An immutable, hashed audit log is written to the blockchain.
            </p>
          </div>
        </div>

        {/* Security Element Card */}
        <div className="glass-panel p-6">
          <h3 className="font-mono text-xs text-[#EBF7F2] uppercase tracking-widest mb-4 border-b border-white/5 pb-2 flex items-center justify-between">
            <span>Cryptographic Specs</span>
            <span className="text-[10px] text-[#8EBF9F]">FHE parameters</span>
          </h3>
          <table className="w-full text-xs font-mono text-[#8EBF9F] leading-relaxed">
            <tbody>
              <tr className="border-b border-white/5">
                <td className="py-2 text-[#EBF7F2]">Compiler</td>
                <td className="py-2 text-right">Zama Concrete Compiler (via concrete-ml v1.9.0)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 text-[#EBF7F2]">Model Architecture</td>
                <td className="py-2 text-right">Quantized Logistic Regression (6-bit)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 text-[#EBF7F2]">On-chain Log Registry</td>
                <td className="py-2 text-right">On-Chain Pre-Tx Gates (Local Hardhat Node)</td>
              </tr>
              <tr>
                <td className="py-2 text-[#EBF7F2]">Client Encryption Daemon</td>
                <td className="py-2 text-right">Local secure element representative (Python 3.10)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
