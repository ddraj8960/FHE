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
    <div className="max-w-3xl mx-auto px-4 py-8 font-mono">
      <div className="border border-[#152219] bg-[#0F1A16] p-6 glow-teal">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#00D4AA] border-b border-[#152219] pb-3 mb-6 flex items-center justify-between">
          <span>Verification Audit Trail</span>
          <Link to="/history" className="text-[10px] text-[#7FB89A] hover:text-[#00D4AA] underline">
            &lt; RETURN TO LEDGER
          </Link>
        </h2>

        {loading ? (
          <div className="text-center py-8 text-[#7FB89A] text-xs animate-pulse-soft uppercase">
            Fetching verification proof...
          </div>
        ) : errorMsg ? (
          <div className="space-y-4">
            <div className="p-3 border border-[#FF4757] bg-[#FF4757]/10 text-xs text-[#FF4757]">
              [ERROR] {errorMsg}
            </div>
            <Link to="/history" className="inline-block text-xs uppercase px-4 py-2 border border-[#152219] text-[#7FB89A] hover:text-[#E8F5F0]">
              Back to History
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-[#152219] pb-4">
              <div>
                <span className="text-[10px] text-[#7FB89A] block uppercase">Verification ID</span>
                <span className="text-xs text-[#E8F5F0]">{record.id}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#7FB89A] block uppercase">Execution Date</span>
                <span className="text-xs text-[#E8F5F0]">
                  {new Date(record.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            {/* FHE proof */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#00D4AA] uppercase tracking-wider">
                Cryptographic Evidence
              </h3>

              <div className="border border-[#152219] bg-[#0A0F0D] p-4 space-y-3">
                <div>
                  <span className="text-[10px] text-[#7FB89A] block uppercase">
                    FHE Ciphertext SHA-256 Hash
                  </span>
                  <span className="text-xs text-[#00D4AA] break-all">{record.encrypted_payload_hash}</span>
                  <p className="text-[10px] text-[#7FB89A] mt-1 italic">
                    * This is the exact hash of the encrypted transaction payload submitted to the server. The raw plaintext amounts and locations are never recorded.
                  </p>
                </div>
              </div>
            </div>

            {/* Database values */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#00D4AA] uppercase tracking-wider">
                Off-Chain Metadata
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="border border-[#152219] bg-[#0A0F0D]/60 p-3">
                  <span className="text-[10px] text-[#7FB89A] block uppercase">Merchant Category</span>
                  <span className="text-xs text-[#E8F5F0]">{record.merchant_category}</span>
                </div>
                <div className="border border-[#152219] bg-[#0A0F0D]/60 p-3">
                  <span className="text-[10px] text-[#7FB89A] block uppercase">Amount Range</span>
                  <span className="text-xs text-[#E8F5F0]">{record.amount_range}</span>
                </div>
                <div className="border border-[#152219] bg-[#0A0F0D]/60 p-3">
                  <span className="text-[10px] text-[#7FB89A] block uppercase">Risk Result</span>
                  <span
                    className={`text-xs font-bold ${
                      record.risk_result === 'LOW'
                        ? 'text-[#00D4AA]'
                        : record.risk_result === 'MEDIUM'
                        ? 'text-[#FFA502]'
                        : 'text-[#FF4757]'
                    }`}
                  >
                    {record.risk_result}
                  </span>
                </div>
              </div>
            </div>

            {/* Blockchain logging */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#00D4AA] uppercase tracking-wider">
                On-Chain Verification
              </h3>

              <div className="border border-[#152219] bg-[#0A0F0D] p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#7FB89A] uppercase">On-Chain Status</span>
                  {record.blockchain_confirmed ? (
                    <span className="text-[#00D4AA] font-bold border border-[#00D4AA]/30 px-2 py-0.5 bg-[#00D4AA]/5">
                      VERIFIED (CONFIRMED ON-CHAIN)
                    </span>
                  ) : (
                    <span className="text-[#FF4757] font-bold border border-[#FF4757]/30 px-2 py-0.5 bg-[#FF4757]/5">
                      PENDING ON-CHAIN WRITE
                    </span>
                  )}
                </div>

                <div className="border-t border-[#152219] pt-3">
                  <span className="text-[10px] text-[#7FB89A] block uppercase">Wallet Address</span>
                  <span className="text-xs text-[#E8F5F0] break-all">{record.wallet_address}</span>
                </div>

                {record.blockchain_tx_hash && (
                  <div className="border-t border-[#152219] pt-3">
                    <span className="text-[10px] text-[#7FB89A] block uppercase">Transaction Hash</span>
                    <a
                      href={`https://amoy.polygonscan.com/tx/${record.blockchain_tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#00D4AA] hover:underline break-all"
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
  );
}
