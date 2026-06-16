# WalletShield (prism-v2) Agent Handover & Project State

This file serves as a complete state-preservation and handover document for any incoming agent to understand the current configuration, modifications, and running state of the WalletShield project. Read this file to instantly understand the workspace state without parsing the entire directory structure.

---

## 📌 Project Overview
WalletShield performs transaction risk scoring on encrypted parameters using Fully Homomorphic Encryption (FHE) with machine learning, and logs audit proof hashes onto a local Hardhat blockchain.

---

## ⚡ Current Workspace Configuration & State

### 1. Python Environment (`venv/`)
*   **Location:** `/Users/prafula/Desktop/fhe/venv/`
*   **Dependency Optimizations:**
    *   Upgraded from `concrete-ml==1.5.0` to **`concrete-ml==1.9.0`** (using `concrete-python==2.10.0` and prebuilt `z3-solver==4.13.0.0`).
    *   This upgrade was critical to bypass compiler segmentation faults during FHE MLIR/LLVM circuit generation on macOS Intel and avoid a long compile-from-source phase for Z3.

### 2. Compiled FHE Model
*   **Status:** Compiled successfully via `venv/bin/python fhe/train.py` (6 features, 96.55% prediction accuracy).
*   **Artifacts:** Generated `client.zip` and `server.zip` inside `fhe/compiled_model/`.

### 3. Smart Contract Deployment (Local Hardhat Node)
*   **Contracts:** `RiskLog.sol`, `ProtocolRegistry.sol`, and `PreTxGate.sol` inside `blockchain/` (compiled with Solidity `0.8.24`).
*   **Deployment Addresses (Local Hardhat Node):**
    *   `RiskLog`: **`0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`**
    *   `ProtocolRegistry`: **`0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`**
    *   `PreTxGate`: **`0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`**

---

## 🛠️ Code Modifications Applied

1.  **FHE Train Script ([fhe/train.py](file:///Users/prafula/Desktop/fhe/fhe/train.py)):**
    *   Changed hardcoded export path from `/mnt/c/Users/.../prism-v2/fhe/compiled_model` to:
        `export_dir = os.path.join(os.path.dirname(__file__), "compiled_model")`
2.  **Backend Inference Server ([backend/main.py](file:///Users/prafula/Desktop/fhe/backend/main.py)):**
    *   Changed hardcoded model directory path to:
        `MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fhe", "compiled_model")`
3.  **Client Encryption Daemon ([client_fhe/main.py](file:///Users/prafula/Desktop/fhe/client_fhe/main.py)):**
    *   Changed hardcoded model directory path to:
        `MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fhe", "compiled_model")`
4.  **Frontend Config ([frontend/.env](file:///Users/prafula/Desktop/fhe/frontend/.env)):**
    *   Created `.env` file containing local API endpoint and contract address:
        ```env
        VITE_API_BASE_URL=http://localhost:8000
        VITE_CONTRACT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
        VITE_REGISTRY_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
        VITE_GATE_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
        ```

---

## 🚀 How to Run the Services

All processes are currently running in the background. If you need to restart them or run them again, use these commands:

### 1. Local Blockchain Node (Port 8545)
```bash
cd blockchain
npx hardhat node
```

### 2. Backend Inference Server (Port 8000)
```bash
# Run from repository root
./venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
*   **Verification:** `curl -s http://localhost:8000/api/health` should return `{"status":"ok"}`.

### 3. Client FHE Daemon (Port 5001)
```bash
cd client_fhe
../venv/bin/uvicorn main:app --host 0.0.0.0 --port 5001
```
*   **Verification:** `curl -s http://localhost:5001/api/client/health` should return `{"status":"ok","keys_generated":false}`.

### 4. React Frontend Web Application (Port 5173)
```bash
cd frontend
npm run dev
```
*   **URL:** [http://localhost:5173/](http://localhost:5173/)
