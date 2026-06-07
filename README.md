# 🛡️ WalletShield — Privacy-Preserving Transaction Risk Scoring

> A Samsung PRISM research project that performs **real-time fraud risk scoring on encrypted transaction data** using Fully Homomorphic Encryption (FHE), with immutable audit trails logged on the Polygon blockchain.

---

## 📌 Problem Statement

Traditional digital wallets and payment systems expose **plaintext transaction metadata** — amounts, merchant categories, device fingerprints, and geographic locations — to centralized fraud-detection servers. This creates serious privacy risks:

- **Data Breaches** — Centralized servers storing raw financial data become high-value attack targets.
- **Surveillance** — Service providers can profile user spending habits without consent.
- **Regulatory Risk** — Handling plaintext financial data creates compliance overhead under GDPR, PCI-DSS, and similar regulations.
- **Trust Deficit** — Users must blindly trust that the fraud-detection provider won't misuse their data.

**WalletShield eliminates this problem.** The server performs machine learning inference on **fully encrypted inputs** — it scores transaction risk *without ever seeing or decrypting* the raw data.

---

## 🏗️ Architecture Overview

WalletShield is composed of **four independent services** that communicate to deliver end-to-end privacy-preserving risk scoring:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                               │
│  ┌───────────────┐                                                  │
│  │   Frontend     │  React + Vite + TailwindCSS                     │
│  │   (MetaMask)   │  Connects wallet, submits tx params, displays   │
│  └──────┬────────┘  risk result & on-chain proof                    │
│         │                                                           │
└─────────┼───────────────────────────────────────────────────────────┘
          │
          │  ① Raw features (amount, merchant, device trust, etc.)
          ▼
┌─────────────────────┐
│  Client FHE Daemon   │  Python / FastAPI (localhost:5001)
│  (Secure Element)    │
│                      │  • Generates FHE private + evaluation keys
│                      │  • Encrypts plaintext features → ciphertext
│                      │  • Decrypts server response → risk class
│                      │  • Private key NEVER leaves this process
└──────────┬───────────┘
           │
           │  ② Ciphertext + Evaluation Key (hex)
           ▼
┌─────────────────────┐
│  Backend Server      │  Python / FastAPI (localhost:8000)
│  (FHE Model Server)  │
│                      │  • Loads compiled FHE model (server.zip)
│                      │  • Runs homomorphic inference on ciphertext
│                      │  • Returns encrypted result (never sees plaintext)
│                      │  • Stores verification metadata in SQLite
└──────────┬───────────┘
           │
           │  ③ Encrypted result → decrypted locally by client daemon
           │  ④ Risk label (LOW / MEDIUM / HIGH) determined client-side
           ▼
┌─────────────────────┐
│  Polygon Amoy        │  Solidity 0.8.24 / Hardhat
│  Blockchain          │
│                      │  • RiskLog.sol smart contract
│                      │  • Stores SHA-256 hash of ciphertext + risk level
│                      │  • Immutable, tamper-proof audit trail
│                      │  • Emits LogCreated events for indexing
└──────────────────────┘
```

---

## 🔄 End-to-End Data Flow

The verification of a single transaction follows this **4-step pipeline**:

### Step 1 — Client-Side Encryption
The user fills in transaction parameters in the frontend UI. The browser sends raw features to the **local FHE client daemon** (never to the internet). The daemon:
1. Generates FHE private and evaluation keys (cached after first generation).
2. Normalizes the 5 input features into a `[0.0, 1.0]` range.
3. Encrypts the feature vector using `concrete-ml`'s `quantize_encrypt_serialize`.
4. Computes a SHA-256 hash of the ciphertext for the on-chain audit log.

> **Privacy guarantee:** The FHE private key never leaves the client daemon process. The server cannot decrypt anything.

### Step 2 — Homomorphic Inference (Server-Side)
The encrypted ciphertext and evaluation key are sent to the backend server. The server:
1. Loads the compiled FHE model (`server.zip`) using `FHEModelServer`.
2. Executes a **quantized logistic regression** directly on the ciphertext.
3. Returns an **encrypted result** — the server has no access to the private key and operates completely blind.

### Step 3 — Client-Side Decryption
The encrypted result is sent back to the client daemon, which:
1. Deserializes and decrypts the result using the private key.
2. Maps the model prediction to a risk class: `0 → LOW`, `1 → MEDIUM`, `2 → HIGH`.

### Step 4 — Blockchain Audit Log
The frontend uses MetaMask to invoke the `RiskLog.sol` smart contract on Polygon Amoy:
1. Calls `createLog(bytes32 payloadHash, string riskLevel)`.
2. The ciphertext's SHA-256 hash and risk label are stored immutably on-chain.
3. The `LogCreated` event is emitted for off-chain indexing.
4. The backend is notified with the blockchain transaction hash for record-keeping.

---

## 🤖 ML Model Details

| Property | Value |
|---|---|
| **Algorithm** | Logistic Regression (multi-class) |
| **Library** | Zama Concrete ML v1.5.0 |
| **Quantization** | 6-bit (as per FHE circuit constraints) |
| **Training Data** | 10,000 synthetic samples (seeded for reproducibility) |
| **Train/Test Split** | 80% / 20% |
| **Input Features** | 5 normalized features (see below) |
| **Output Classes** | 3 — LOW (0), MEDIUM (1), HIGH (2) |

### Input Feature Vector

| # | Feature | Range | Description |
|---|---------|-------|-------------|
| 1 | `amount_normalized` | 0.0 – 1.0 | Transaction amount normalized against a $10,000 ceiling |
| 2 | `merchant_risk` | 0.0 – 1.0 | Category-based risk (Groceries=0.1 → Cash Withdrawal=0.9) |
| 3 | `device_trust_risk` | 0.0 – 1.0 | Inverted device trust score (0=trusted, 1=untrusted) |
| 4 | `tx_frequency_normalized` | 0.0 – 1.0 | Number of transactions in 24h, normalized to 50 max |
| 5 | `location_risk` | 0.0 – 1.0 | Geographic risk score |

### Risk Classification Thresholds

```
raw_risk = 0.30×amount + 0.25×merchant + 0.20×device + 0.15×freq + 0.10×location

LOW    → raw_risk < 0.40
MEDIUM → 0.40 ≤ raw_risk < 0.62
HIGH   → raw_risk ≥ 0.62
```

---

## 🧩 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, TailwindCSS 4, ethers.js 6 |
| **Client FHE Daemon** | Python, FastAPI, Concrete ML 1.5.0 |
| **Backend Server** | Python, FastAPI, Concrete ML 1.5.0, SQLAlchemy, SQLite |
| **Blockchain** | Solidity 0.8.24, Hardhat, Polygon Amoy Testnet |
| **ML Training** | scikit-learn, NumPy, Pandas, Concrete ML |
| **Wallet** | MetaMask (browser extension) |

---

## 📁 Project Structure

```
prism-v2/
├── frontend/               # React + Vite web application
│   ├── src/
│   │   ├── components/     # Reusable UI components (Navbar)
│   │   ├── pages/          # Landing, Verify, History, Audit pages
│   │   ├── App.jsx         # Root component with routing & wallet state
│   │   ├── index.css       # Global styles
│   │   └── main.jsx        # Entry point
│   ├── .env.example        # Environment variables template
│   └── package.json
│
├── client_fhe/             # Local FHE encryption/decryption daemon
│   ├── main.py             # FastAPI server — key gen, encrypt, decrypt
│   └── requirements.txt
│
├── backend/                # Server-side FHE inference API
│   ├── main.py             # FastAPI server — verify, confirm, history, audit
│   ├── models.py           # SQLAlchemy ORM models (Verification, FHESession)
│   ├── schemas.py          # Pydantic request/response schemas
│   ├── database.py         # SQLite database configuration
│   └── requirements.txt
│
├── fhe/                    # Model training & FHE compilation
│   ├── train.py            # Synthetic data generation, training, FHE compilation
│   ├── compiled_model/     # Compiled FHE artifacts (client.zip, server.zip)
│   └── requirements.txt
│
├── blockchain/             # Smart contract & deployment scripts
│   ├── contracts/
│   │   └── RiskLog.sol     # On-chain audit log contract
│   ├── scripts/
│   │   └── deploy.js       # Hardhat deployment script
│   ├── test/
│   │   └── RiskLog.js      # Contract unit tests
│   ├── hardhat.config.js   # Hardhat config (Polygon Amoy network)
│   ├── .env.example        # RPC URL & deployer private key
│   └── package.json
│
├── .gitignore
└── README.md               # ← You are here
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+** (with pip)
- **Node.js 18+** (with npm)
- **MetaMask** browser extension
- **Polygon Amoy testnet MATIC** ([Faucet](https://faucet.polygon.technology/))

---

### 1. Train the FHE Model

```bash
cd fhe
pip install -r requirements.txt
python train.py
```

This generates `compiled_model/client.zip` and `compiled_model/server.zip`.

---

### 2. Deploy the Smart Contract

```bash
cd blockchain
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
# Edit .env with your Polygon Amoy RPC URL and deployer private key
```

Deploy to Polygon Amoy:

```bash
npx hardhat run scripts/deploy.js --network amoy
```

Copy the deployed contract address for the frontend configuration.

To run the contract tests:

```bash
npx hardhat test
```

---

### 3. Start the Backend Server

```bash
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

> **Note:** The backend loads `fhe/compiled_model/server.zip` at startup. Ensure the model is trained first.

---

### 4. Start the Client FHE Daemon

```bash
cd client_fhe
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5001 --reload
```

> **Note:** This daemon loads `fhe/compiled_model/client.zip` and manages FHE key generation and encryption locally.

---

### 5. Start the Frontend

```bash
cd frontend
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8000
# Set VITE_CONTRACT_ADDRESS=<deployed-contract-address>
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser with MetaMask connected to the Polygon Amoy network.

---

## 🔐 Security & Privacy Guarantees

| Guarantee | How It's Achieved |
|---|---|
| **Server never sees plaintext features** | FHE encryption happens locally in the client daemon; the server operates only on ciphertext |
| **Private key stays local** | FHE keys are generated and cached in the client daemon memory; never transmitted |
| **Tamper-proof audit trail** | Ciphertext hash + risk label are written to an immutable Polygon smart contract |
| **Verifiable computation** | SHA-256 of the encrypted payload is stored on-chain, allowing anyone to verify the audit record |
| **No raw data stored server-side** | The backend stores only bucketed amount ranges, merchant categories, and hashes — never exact values |

---

## 📜 API Reference

### Backend Server (`localhost:8000`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/verify` | Submit encrypted ciphertext + eval key for FHE inference |
| `POST` | `/api/blockchain/confirm` | Confirm blockchain transaction hash for a verification |
| `GET` | `/api/history?wallet=<address>` | Get verification history for a wallet |
| `GET` | `/api/audit/{id}` | Get full audit record by verification ID |

### Client FHE Daemon (`localhost:5001`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/client/health` | Health check + key generation status |
| `POST` | `/api/client/keys` | Generate FHE private and evaluation keys |
| `POST` | `/api/client/encrypt` | Encrypt a feature vector under FHE |
| `POST` | `/api/client/decrypt` | Decrypt an encrypted model result |

---

## 🧪 Smart Contract

**`RiskLog.sol`** — Deployed on Polygon Amoy Testnet

| Function | Description |
|----------|-------------|
| `createLog(bytes32 payloadHash, string riskLevel)` | Write an audit entry (caller = wallet address) |
| `getLog(uint256 id)` | Retrieve a specific log entry by ID |
| `getUserLogs(address wallet)` | Retrieve all log entries for a wallet |
| `logCount()` | Total number of audit entries |

**Events:**
- `LogCreated(uint256 indexed id, address indexed wallet, string riskLevel)`

---

## 📄 License

This project is developed as part of the **Samsung PRISM** (Preparing and Inspiring Student Minds) research program.

---

<p align="center">
  <sub>Built with 🔐 Zama Concrete ML · ⛓️ Polygon · ⚛️ React</sub>
</p>
