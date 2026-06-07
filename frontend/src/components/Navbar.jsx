import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar({ walletAddress, connectWallet, disconnectWallet }) {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) =>
    `font-mono text-sm tracking-wider transition-colors duration-200 uppercase ${
      isActive(path)
        ? 'text-[#00D4AA] border-b border-[#00D4AA] pb-1'
        : 'text-[#7FB89A] hover:text-[#E8F5F0]'
    }`;

  return (
    <nav className="border-b border-[#152219] bg-[#0A0F0D] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3">
            <div className="h-6 w-6 border border-[#00D4AA] flex items-center justify-center glow-teal">
              <span className="font-mono text-xs text-[#00D4AA] font-bold">W</span>
            </div>
            <Link to="/" className="font-mono text-lg font-bold tracking-widest text-[#E8F5F0]">
              WALLET<span className="text-[#00D4AA]">SHIELD</span>
            </Link>
            <span className="hidden md:inline px-2 py-0.5 border border-[#152219] bg-[#0F1A16] font-mono text-[10px] text-[#7FB89A] rounded-sm uppercase tracking-widest">
              v1.0.0-beta
            </span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex space-x-8">
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
                {/* Connection Status indicator */}
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D4AA] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00D4AA]"></span>
                </span>
                <span className="font-mono text-xs text-[#7FB89A] border border-[#152219] bg-[#0F1A16] px-3 py-1.5 rounded-sm">
                  {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
                </span>
                <button
                  onClick={disconnectWallet}
                  className="font-mono text-xs uppercase px-2.5 py-1.5 border border-[#FF4757] text-[#FF4757] hover:bg-[#FF4757]/10 transition-colors duration-200"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="font-mono text-xs uppercase px-4 py-2 border border-[#00D4AA] text-[#00D4AA] bg-transparent hover:bg-[#00D4AA]/10 transition-all duration-200 glow-teal hover:glow-teal-strong"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
        {/* Mobile Navigation Links */}
        <div className="flex md:hidden justify-center space-x-6 py-2 border-t border-[#152219]/40">
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
