import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function History({ walletAddress }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (walletAddress) {
      fetchHistory();
    }
  }, [walletAddress]);

  const fetchHistory = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.get(`${BACKEND_URL}/api/history`, {
        params: { wallet: walletAddress }
      });
      setHistory(res.data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load transaction audit ledger.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-mono">
      <div className="border border-[#152219] bg-[#0F1A16] p-6 glow-teal">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#00D4AA] border-b border-[#152219] pb-3 mb-6 flex items-center justify-between">
          <span>Audit Ledger</span>
          <button
            onClick={fetchHistory}
            disabled={!walletAddress || loading}
            className="text-xs uppercase px-3 py-1 border border-[#152219] hover:border-[#00D4AA] text-[#7FB89A] hover:text-[#E8F5F0] transition-colors duration-200"
          >
            {loading ? 'SYNCING...' : 'FORCE REFRESH'}
          </button>
        </h2>

        {!walletAddress ? (
          <div className="text-center py-8">
            <p className="text-[#7FB89A] text-xs uppercase mb-2">Connect wallet to view ledger</p>
          </div>
        ) : loading && history.length === 0 ? (
          <div className="text-center py-8 text-[#7FB89A] text-xs animate-pulse-soft uppercase">
            Fetching records from database...
          </div>
        ) : errorMsg ? (
          <div className="p-3 border border-[#FF4757] bg-[#FF4757]/10 text-xs text-[#FF4757]">
            [ERROR] {errorMsg}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-[#7FB89A] text-xs uppercase">
            No transaction records found for this wallet address.
          </div>
        ) : (
          /* Mono ledger table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#152219] text-[#E8F5F0]">
                  <th className="py-3 px-2 uppercase font-semibold">Verification ID</th>
                  <th className="py-3 px-2 uppercase font-semibold">Timestamp</th>
                  <th className="py-3 px-2 uppercase font-semibold">Protocol</th>
                  <th className="py-3 px-2 uppercase font-semibold">Investment Range</th>
                  <th className="py-3 px-2 uppercase font-semibold">Risk Rating</th>
                  <th className="py-3 px-2 uppercase font-semibold text-center">Status</th>
                  <th className="py-3 px-2 uppercase font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#152219]/40 text-[#7FB89A]">
                {history.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#152219]/20 transition-colors">
                    <td className="py-3 px-2 font-mono text-[11px] text-[#00D4AA]">
                      {tx.id.substring(0, 8)}...
                    </td>
                    <td className="py-3 px-2 text-[11px]">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-2">{tx.protocol_name}</td>
                    <td className="py-3 px-2">{tx.investment_range}</td>
                    <td className="py-3 px-2">
                      <span
                        className={`px-1.5 py-0.5 border text-[10px] font-bold ${
                          tx.risk_result === 'LOW'
                            ? 'border-[#00D4AA] text-[#00D4AA]'
                            : tx.risk_result === 'MEDIUM'
                            ? 'border-[#FFA502] text-[#FFA502]'
                            : 'border-[#FF4757] text-[#FF4757]'
                        }`}
                      >
                        {tx.risk_result}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      {tx.blockchain_confirmed ? (
                        <span className="text-[#00D4AA] text-[10px] uppercase border border-[#00D4AA]/30 px-1 py-0.2 bg-[#00D4AA]/5">
                          ON-CHAIN
                        </span>
                      ) : (
                        <span className="text-[#FF4757] text-[10px] uppercase border border-[#FF4757]/30 px-1 py-0.2 bg-[#FF4757]/5">
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex justify-end space-x-3">
                        <Link
                          to={`/audit/${tx.id}`}
                          className="hover:text-[#00D4AA] underline uppercase text-[10px]"
                        >
                          Audit
                        </Link>
                        {tx.blockchain_tx_hash && (
                          <a
                            href={`https://etherscan.io/tx/${tx.blockchain_tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[#00D4AA] hover:underline uppercase text-[10px]"
                          >
                            Scan
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
