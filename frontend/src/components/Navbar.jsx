import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar({ walletAddress, connectWallet, disconnectWallet }) {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) =>
    `font-mono text-xs tracking-widest uppercase transition-all duration-200 font-bold px-3 py-2 rounded ${
      isActive(path)
        ? 'text-[#C0FF00] bg-[#C0FF00]/5 border border-[#C0FF00]/10'
        : 'text-[#909090] hover:text-[#F5F5F5] border border-transparent'
    }`;

  return (
    <nav className="border-b border-[#222222] bg-[#050505] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3">
            <div className="h-6 w-6 border border-[#C0FF00] rounded flex items-center justify-center bg-[#C0FF00]/5">
              <span className="font-mono text-xs text-[#C0FF00] font-extrabold">W</span>
            </div>
            <Link to="/" className="font-mono text-sm font-bold tracking-widest text-[#F5F5F5]">
              WALLET<span className="text-[#C0FF00]">SHIELD</span>
            </Link>
            <span className="hidden sm:inline px-2 py-0.5 border border-[#222222] bg-[#111111] font-mono text-[9px] text-[#909090] rounded uppercase tracking-wider">
              V2.0
            </span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex space-x-2">
            <Link to="/" className={linkClass('/')}>
              Overview
            </Link>
            <Link to="/verify" className={linkClass('/verify')}>
              Verify Tx
            </Link>
            <Link to="/history" className={linkClass('/history')}>
              Ledger
            </Link>
          </div>

          {/* Wallet Actions */}
          <div className="flex items-center space-x-4">
            {walletAddress ? (
              <div className="flex items-center space-x-3">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C0FF00] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#C0FF00]"></span>
                </span>
                <span className="font-mono text-xs text-[#909090] border border-[#222222] bg-[#111111] px-3 py-1.5 rounded">
                  {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
                </span>
                <button
                  onClick={disconnectWallet}
                  className="font-mono text-[10px] uppercase font-bold px-2.5 py-1.5 border border-[#FF5A00]/20 text-[#FF5A00] hover:bg-[#FF5A00]/5 hover:border-[#FF5A00] rounded transition-all duration-200"
                >
                  Exit
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="font-mono text-xs uppercase px-4 py-2 border border-[#C0FF00] text-[#050505] bg-[#C0FF00] hover:bg-[#D4FF4D] rounded transition-all duration-200 font-bold tracking-widest shadow-[0_2px_8px_rgba(192,255,0,0.1)]"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
        {/* Mobile Navigation Links */}
        <div className="flex md:hidden justify-center space-x-4 py-2 border-t border-[#222222]/50">
          <Link to="/" className={linkClass('/')}>
            Overview
          </Link>
          <Link to="/verify" className={linkClass('/verify')}>
            Verify Tx
          </Link>
          <Link to="/history" className={linkClass('/history')}>
            Ledger
          </Link>
        </div>
      </div>
    </nav>
  );
}
