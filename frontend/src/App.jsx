import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Verify from './pages/Verify';
import History from './pages/History';
import Audit from './pages/Audit';
import axios from 'axios';
import { CLIENT_DAEMON_URL } from './config';

function App() {
  const [walletAddress, setWalletAddress] = useState('');

  // Check if wallet was previously connected
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts) => {
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            triggerClientKeyGen();
          }
        })
        .catch(err => console.error(err));

      // Listen for account change events
      const handleAccounts = (accounts) => {
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          triggerClientKeyGen();
        } else {
          setWalletAddress('');
        }
      };

      window.ethereum.on('accountsChanged', handleAccounts);

      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccounts);
        }
      };
    }
  }, []);

  const triggerClientKeyGen = async () => {
    try {
      // Warm up the FHE keys on client daemon (if not already generated)
      await axios.post(`${CLIENT_DAEMON_URL}/api/client/keys`);
    } catch (err) {
      console.error("Failed to generate/warm FHE keys on local daemon:", err);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask is not installed. Please install MetaMask to use WalletShield.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWalletAddress(accounts[0]);
      triggerClientKeyGen();
    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress('');
  };

  return (
    <Router>
      <div className="min-h-screen bg-[#0A0F0D] flex flex-col">
        <Navbar
          walletAddress={walletAddress}
          connectWallet={connectWallet}
          disconnectWallet={disconnectWallet}
        />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Landing walletAddress={walletAddress} connectWallet={connectWallet} />} />
            <Route path="/verify" element={<Verify walletAddress={walletAddress} connectWallet={connectWallet} />} />
            <Route path="/history" element={<History walletAddress={walletAddress} />} />
            <Route path="/audit/:id" element={<Audit />} />
          </Routes>
        </main>
        <footer className="border-t border-[#152219] bg-[#0A0F0D] py-6 text-center">
          <p className="font-mono text-[10px] text-[#7FB89A] tracking-wider">
            WALLET SHIELD // RESEARCH DEMO // SECURED BY ZAMA CONCRETE ML
          </p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
