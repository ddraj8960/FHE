import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import { getRiskColor } from '../utils/risk';

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
    <div className="relative min-h-[calc(100vh-4rem)] cyber-grid py-12 px-4 font-mono">
      <div className="relative max-w-3xl mx-auto">
        <div className="dashboard-card p-6 sm:p-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#C0FF00] border-b border-[#222222] pb-4 mb-6 flex items-center justify-between">
            <span>Verification Audit Trail</span>
            <Link to="/history" className="text-[10px] text-[#909090] hover:text-[#C0FF00] underline tracking-widest font-bold">
              &lt; RETURN TO LEDGER
            </Link>
          </h2>

          {loading ? (
            <div className="text-center py-12 text-[#909090] text-xs animate-pulse-soft uppercase tracking-widest">
              Fetching verification proof...
            </div>
          ) : errorMsg ? (
            <div className="space-y-6">
              <div className="p-3 border border-[#FF2A5F] bg-[#FF2A5F]/10 text-xs text-[#FF2A5F] rounded">
                [ERROR] {errorMsg}
              </div>
              <Link to="/history" className="inline-block text-xs uppercase px-4 py-2 border border-[#222222] text-[#909090] hover:text-[#F5F5F5] rounded transition-colors">
                Back to History
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-[#222222] pb-6">
                <div>
                  <span className="text-[10px] text-[#909090] block uppercase tracking-widest mb-1.5 font-bold">Verification ID</span>
                  <span className="text-xs text-[#F5F5F5] bg-[#090909] p-2.5 rounded block border border-[#222222]">{record.id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#909090] block uppercase tracking-widest mb-1.5 font-bold">Execution Date</span>
                  <span className="text-xs text-[#F5F5F5] bg-[#090909] p-2.5 rounded block border border-[#222222]">
                    {new Date(record.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* FHE proof */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#C0FF00] uppercase tracking-widest">
                  Cryptographic Evidence
                </h3>

                <div className="border border-[#222222] bg-[#090909] p-4 rounded space-y-3">
                  <div>
                    <span className="text-[10px] text-[#909090] block uppercase tracking-widest mb-1.5 font-bold">
                      FHE Ciphertext SHA-256 Hash
                    </span>
                    <span className="text-xs text-[#C0FF00] break-all bg-[#050505] p-2.5 rounded border border-[#222222] block">{record.encrypted_payload_hash}</span>
                    <p className="text-[10px] text-[#909090] mt-2 italic leading-relaxed">
                      * This is the exact hash of the encrypted transaction payload submitted to the server. The raw plaintext amounts and concentrations are never recorded on-chain or stored server-side.
                    </p>
                  </div>
                </div>
              </div>

              {/* Database values */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#C0FF00] uppercase tracking-widest">
                  Off-Chain Metadata
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="border border-[#222222] bg-[#090909] p-4 rounded">
                    <span className="text-[10px] text-[#909090] block uppercase tracking-widest mb-1.5 font-bold">Protocol</span>
                    <span className="text-xs text-[#F5F5F5] font-semibold">{record.protocol_name}</span>
                  </div>
                  <div className="border border-[#222222] bg-[#090909] p-4 rounded">
                    <span className="text-[10px] text-[#909090] block uppercase tracking-widest mb-1.5 font-bold">Investment Range</span>
                    <span className="text-xs text-[#F5F5F5]">{record.investment_range}</span>
                  </div>
                  <div className="border border-[#222222] bg-[#090909] p-4 rounded">
                    <span className="text-[10px] text-[#909090] block uppercase tracking-widest mb-1.5 font-bold">Risk Result</span>
                    <span
                      className={`text-xs font-bold ${getRiskColor(record.risk_result)}`}
                    >
                      {record.risk_result}
                    </span>
                  </div>
                </div>
              </div>

              {/* Blockchain logging */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#C0FF00] uppercase tracking-widest">
                  On-Chain Verification
                </h3>

                <div className="border border-[#222222] bg-[#090909] p-4 rounded space-y-4">
                  <div className="flex justify-between items-center text-xs border-b border-[#222222] pb-3">
                    <span className="text-[#909090] uppercase tracking-widest font-bold">On-Chain Status</span>
                    {record.blockchain_confirmed ? (
                      <span className="text-[#C0FF00] font-bold border border-[#C0FF00]/20 px-2.5 py-1 rounded bg-[#C0FF00]/5">
                        VERIFIED (CONFIRMED ON-CHAIN)
                      </span>
                    ) : (
                      <span className="text-[#FF2A5F] font-bold border border-[#FF2A5F]/20 px-2.5 py-1 rounded bg-[#FF2A5F]/5">
                        PENDING ON-CHAIN WRITE
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-[#909090] block uppercase tracking-widest mb-1.5 font-bold">Wallet Address</span>
                    <span className="text-xs text-[#F5F5F5] break-all bg-[#050505] p-2 rounded block border border-[#222222]">{record.wallet_address}</span>
                  </div>

                  {record.blockchain_tx_hash && (
                    <div>
                      <span className="text-[10px] text-[#909090] block uppercase tracking-widest mb-1.5 font-bold">Transaction Hash</span>
                      <a
                        href={`https://etherscan.io/tx/${record.blockchain_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#C0FF00] hover:underline break-all bg-[#050505] p-2 rounded block border border-[#222222] transition-colors"
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
