import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function Audit() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchRecord();
  }, [id]);

  const fetchRecord = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.get(`${BACKEND_URL}/api/audit/${id}`);
      setRecord(res.data);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to retrieve transaction audit details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] cyber-grid scanlines py-12 px-4 font-mono">
      <div className="cyber-radial"></div>

      <div className="relative z-10 max-w-3xl mx-auto">
        <div className="glass-panel p-6 sm:p-8 glow-teal">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#00FFC4] border-b border-white/5 pb-4 mb-6 flex items-center justify-between">
            <span>Verification Audit Trail</span>
            <Link to="/history" className="text-[10px] text-[#8EBF9F] hover:text-[#00FFC4] underline tracking-wider">
              &lt; RETURN TO LEDGER
            </Link>
          </h2>

          {loading ? (
            <div className="text-center py-12 text-[#8EBF9F] text-xs animate-pulse-soft uppercase tracking-wider">
              Fetching verification proof...
            </div>
          ) : errorMsg ? (
            <div className="space-y-6">
              <div className="p-3 border border-[#FF2A5F] bg-[#FF2A5F]/10 text-xs text-[#FF2A5F] rounded">
                [ERROR] {errorMsg}
              </div>
              <Link to="/history" className="inline-block text-xs uppercase px-4 py-2 border border-white/15 text-[#8EBF9F] hover:text-[#EBF7F2] transition-colors rounded-sm">
                Back to History
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-white/5 pb-6">
                <div>
                  <span className="text-[10px] text-[#8EBF9F] block uppercase tracking-wider mb-1">Verification ID</span>
                  <span className="text-xs text-[#EBF7F2] bg-[#040807] p-2 rounded block border border-white/5">{record.id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8EBF9F] block uppercase tracking-wider mb-1">Execution Date</span>
                  <span className="text-xs text-[#EBF7F2] bg-[#040807] p-2 rounded block border border-white/5">
                    {new Date(record.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* FHE proof */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#00FFC4] uppercase tracking-wider">
                  Cryptographic Evidence
                </h3>

                <div className="border border-white/5 bg-[#040807]/60 p-4 rounded-md space-y-3">
                  <div>
                    <span className="text-[10px] text-[#8EBF9F] block uppercase tracking-wider mb-1">
                      FHE Ciphertext SHA-256 Hash
                    </span>
                    <span className="text-xs text-[#00FFC4] break-all bg-[#040807] p-2 rounded.5 border border-white/5 block">{record.encrypted_payload_hash}</span>
                    <p className="text-[10px] text-[#8EBF9F] mt-2 italic leading-relaxed">
                      * This is the exact hash of the encrypted transaction payload submitted to the server. The raw plaintext amounts and concentrations are never recorded on-chain or stored server-side.
                    </p>
                  </div>
                </div>
              </div>

              {/* Database values */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#00FFC4] uppercase tracking-wider">
                  Off-Chain Metadata
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="border border-white/5 bg-[#040807]/40 p-4 rounded-md">
                    <span className="text-[10px] text-[#8EBF9F] block uppercase tracking-wider mb-1">Protocol</span>
                    <span className="text-xs text-[#EBF7F2] font-semibold">{record.protocol_name}</span>
                  </div>
                  <div className="border border-white/5 bg-[#040807]/40 p-4 rounded-md">
                    <span className="text-[10px] text-[#8EBF9F] block uppercase tracking-wider mb-1">Investment Range</span>
                    <span className="text-xs text-[#EBF7F2]">{record.investment_range}</span>
                  </div>
                  <div className="border border-white/5 bg-[#040807]/40 p-4 rounded-md">
                    <span className="text-[10px] text-[#8EBF9F] block uppercase tracking-wider mb-1">Risk Result</span>
                    <span
                      className={`text-xs font-bold ${
                        record.risk_result === 'LOW'
                          ? 'text-[#00FFC4]'
                          : record.risk_result === 'MEDIUM'
                          ? 'text-[#FFAD00]'
                          : 'text-[#FF2A5F]'
                      }`}
                    >
                      {record.risk_result}
                    </span>
                  </div>
                </div>
              </div>

              {/* Blockchain logging */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#00FFC4] uppercase tracking-wider">
                  On-Chain Verification
                </h3>

                <div className="border border-white/5 bg-[#040807]/60 p-4 rounded-md space-y-4">
                  <div className="flex justify-between items-center text-xs border-b border-white/5 pb-3">
                    <span className="text-[#8EBF9F] uppercase tracking-wider">On-Chain Status</span>
                    {record.blockchain_confirmed ? (
                      <span className="text-[#00FFC4] font-bold border border-[#00FFC4]/20 px-2.5 py-1 rounded bg-[#00FFC4]/5 shadow-[0_0_8px_rgba(0,255,196,0.1)]">
                        VERIFIED (CONFIRMED ON-CHAIN)
                      </span>
                    ) : (
                      <span className="text-[#FF2A5F] font-bold border border-[#FF2A5F]/20 px-2.5 py-1 rounded bg-[#FF2A5F]/5 shadow-[0_0_8px_rgba(255,42,95,0.1)]">
                        PENDING ON-CHAIN WRITE
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-[#8EBF9F] block uppercase tracking-wider mb-1">Wallet Address</span>
                    <span className="text-xs text-[#EBF7F2] break-all bg-[#040807] p-2 rounded block border border-white/5">{record.wallet_address}</span>
                  </div>

                  {record.blockchain_tx_hash && (
                    <div>
                      <span className="text-[10px] text-[#8EBF9F] block uppercase tracking-wider mb-1">Transaction Hash</span>
                      <a
                        href={`https://etherscan.io/tx/${record.blockchain_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#00FFC4] hover:underline break-all bg-[#040807] p-2 rounded block border border-white/5 transition-colors"
                      >
                        {record.blockchain_tx_hash}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
