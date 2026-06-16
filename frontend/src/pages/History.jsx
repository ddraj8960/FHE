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
    <div className="relative min-h-[calc(100vh-4rem)] cyber-grid scanlines py-12 px-4 font-mono">
      <div className="cyber-radial"></div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="glass-panel p-6 sm:p-8 glow-teal">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#00FFC4] border-b border-white/5 pb-4 mb-6 flex items-center justify-between">
            <span>Audit Ledger</span>
            <button
              onClick={fetchHistory}
              disabled={!walletAddress || loading}
              className="text-xs uppercase px-3 py-1.5 border border-white/10 hover:border-[#00FFC4] text-[#8EBF9F] hover:text-[#EBF7F2] transition-colors rounded-sm bg-white/5"
            >
              {loading ? 'SYNCING...' : 'FORCE REFRESH'}
            </button>
          </h2>

          {!walletAddress ? (
            <div className="text-center py-12">
              <p className="text-[#8EBF9F] text-xs uppercase tracking-wider">Connect wallet to view ledger</p>
            </div>
          ) : loading && history.length === 0 ? (
            <div className="text-center py-12 text-[#8EBF9F] text-xs animate-pulse-soft uppercase tracking-wider">
              Fetching records from database...
            </div>
          ) : errorMsg ? (
            <div className="p-3 border border-[#FF2A5F] bg-[#FF2A5F]/10 text-xs text-[#FF2A5F] rounded">
              [ERROR] {errorMsg}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-[#8EBF9F] text-xs uppercase tracking-wider">
              No transaction records found for this wallet address.
            </div>
          ) : (
            /* Mono ledger table */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[#EBF7F2] opacity-80">
                    <th className="py-4 px-3 uppercase font-semibold tracking-wider">Verification ID</th>
                    <th className="py-4 px-3 uppercase font-semibold tracking-wider">Timestamp</th>
                    <th className="py-4 px-3 uppercase font-semibold tracking-wider">Protocol</th>
                    <th className="py-4 px-3 uppercase font-semibold tracking-wider">Investment Range</th>
                    <th className="py-4 px-3 uppercase font-semibold tracking-wider">Risk Rating</th>
                    <th className="py-4 px-3 uppercase font-semibold tracking-wider text-center">Status</th>
                    <th className="py-4 px-3 uppercase font-semibold tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-[#8EBF9F]">
                  {history.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 px-3 font-mono text-[11px] text-[#00FFC4]">
                        {tx.id.substring(0, 8)}...
                      </td>
                      <td className="py-4 px-3 text-[11px]">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="py-4 px-3 text-[#EBF7F2] font-semibold">{tx.protocol_name}</td>
                      <td className="py-4 px-3">{tx.investment_range}</td>
                      <td className="py-4 px-3">
                        <span
                          className={`px-2 py-0.5 border text-[10px] font-bold rounded-sm ${
                            tx.risk_result === 'LOW'
                              ? 'border-[#00FFC4]/30 text-[#00FFC4] bg-[#00FFC4]/5 shadow-[0_0_8px_rgba(0,255,196,0.1)]'
                              : tx.risk_result === 'MEDIUM'
                              ? 'border-[#FFAD00]/30 text-[#FFAD00] bg-[#FFAD00]/5 shadow-[0_0_8px_rgba(255,173,0,0.1)]'
                              : 'border-[#FF2A5F]/30 text-[#FF2A5F] bg-[#FF2A5F]/5 shadow-[0_0_8px_rgba(255,42,95,0.1)]'
                          }`}
                        >
                          {tx.risk_result}
                        </span>
                      </td>
                      <td className="py-4 px-3 text-center">
                        {tx.blockchain_confirmed ? (
                          <span className="text-[#00FFC4] text-[10px] uppercase border border-[#00FFC4]/20 px-2 py-0.5 rounded-sm bg-[#00FFC4]/5 font-semibold">
                            ON-CHAIN
                          </span>
                        ) : (
                          <span className="text-[#FF2A5F] text-[10px] uppercase border border-[#FF2A5F]/20 px-2 py-0.5 rounded-sm bg-[#FF2A5F]/5 font-semibold">
                            PENDING
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-3 text-right">
                        <div className="flex justify-end space-x-4">
                          <Link
                            to={`/audit/${tx.id}`}
                            className="hover:text-[#00FFC4] underline uppercase text-[10px] tracking-wider"
                          >
                            Audit
                          </Link>
                          {tx.blockchain_tx_hash && (
                            <a
                              href={`https://etherscan.io/tx/${tx.blockchain_tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[#00FFC4] hover:underline uppercase text-[10px] tracking-wider"
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
    </div>
  );
}
