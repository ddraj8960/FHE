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
    <div className="relative min-h-[calc(100vh-4rem)] cyber-grid py-12 px-4 font-mono">
      <div className="relative max-w-6xl mx-auto">
        <div className="dashboard-card p-6 sm:p-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#C0FF00] border-b border-[#222222] pb-4 mb-6 flex items-center justify-between">
            <span>Audit Ledger Registry</span>
            <button
              onClick={fetchHistory}
              disabled={!walletAddress || loading}
              className="text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 border border-[#222222] hover:border-[#C0FF00] text-[#909090] hover:text-[#F5F5F5] transition-colors rounded bg-[#090909]"
            >
              {loading ? 'SYNCING...' : 'FORCE REFRESH'}
            </button>
          </h2>

          {!walletAddress ? (
            <div className="text-center py-12">
              <p className="text-[#909090] text-xs uppercase tracking-wider">Connect wallet to view historical ledger logs</p>
            </div>
          ) : loading && history.length === 0 ? (
            <div className="text-center py-12 text-[#909090] text-xs animate-pulse-soft uppercase tracking-wider">
              Fetching ledger logs from database...
            </div>
          ) : errorMsg ? (
            <div className="p-3 border border-[#FF2A5F] bg-[#FF2A5F]/10 text-xs text-[#FF2A5F] rounded">
              [ERROR] {errorMsg}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-[#909090] text-xs uppercase tracking-wider">
              No historical verifications recorded for this wallet address.
            </div>
          ) : (
            /* Mono ledger table */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#222222] text-[#F5F5F5] opacity-80">
                    <th className="py-4 px-3 uppercase font-bold tracking-wider">Verification ID</th>
                    <th className="py-4 px-3 uppercase font-bold tracking-wider">Timestamp</th>
                    <th className="py-4 px-3 uppercase font-bold tracking-wider">Target Protocol</th>
                    <th className="py-4 px-3 uppercase font-bold tracking-wider">Investment Range</th>
                    <th className="py-4 px-3 uppercase font-bold tracking-wider">Risk Rating</th>
                    <th className="py-4 px-3 uppercase font-bold tracking-wider text-center">Enforcement</th>
                    <th className="py-4 px-3 uppercase font-bold tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222]/50 text-[#909090]">
                  {history.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#090909] transition-colors">
                      <td className="py-4 px-3 font-mono text-[11px] text-[#C0FF00]">
                        {tx.id.substring(0, 8)}...
                      </td>
                      <td className="py-4 px-3 text-[11px]">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                      <td className="py-4 px-3 text-[#F5F5F5] font-semibold">{tx.protocol_name}</td>
                      <td className="py-4 px-3">{tx.investment_range}</td>
                      <td className="py-4 px-3">
                        <span
                          className={`px-2 py-0.5 border text-[9px] font-bold rounded ${
                            tx.risk_result === 'LOW'
                              ? 'border-[#C0FF00]/20 text-[#C0FF00] bg-[#C0FF00]/5'
                              : tx.risk_result === 'MEDIUM'
                              ? 'border-[#FFB300]/20 text-[#FFB300] bg-[#FFB300]/5'
                              : 'border-[#FF2A5F]/20 text-[#FF2A5F] bg-[#FF2A5F]/5'
                          }`}
                        >
                          {tx.risk_result}
                        </span>
                      </td>
                      <td className="py-4 px-3 text-center">
                        {tx.blockchain_confirmed ? (
                          <span className="text-[#C0FF00] text-[9px] font-bold uppercase border border-[#C0FF00]/20 px-2.5 py-0.5 rounded bg-[#C0FF00]/5 tracking-wider">
                            ON-CHAIN
                          </span>
                        ) : (
                          <span className="text-[#FF2A5F] text-[9px] font-bold uppercase border border-[#FF2A5F]/20 px-2.5 py-0.5 rounded bg-[#FF2A5F]/5 tracking-wider">
                            PENDING
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-3 text-right">
                        <div className="flex justify-end space-x-4">
                          <Link
                            to={`/audit/${tx.id}`}
                            className="hover:text-[#C0FF00] underline uppercase text-[10px] tracking-widest font-bold"
                          >
                            Audit
                          </Link>
                          {tx.blockchain_tx_hash && (
                            <a
                              href={`https://etherscan.io/tx/${tx.blockchain_tx_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[#C0FF00] hover:underline uppercase text-[10px] tracking-widest font-bold"
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
