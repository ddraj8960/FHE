# 🛡️ WalletShield — Mentor Demo Guide & Presentation Script
*A Quick Reference Sheet for Demonstrating the Privacy-Preserving DeFi Risk Oracle*

---

## 📌 1. The Demo Pitch (The "Why")
When presenting to mentors, start by explaining the problem:
> *"Traditional financial risk analysis (e.g., fraud checking) forces users to send private details—like exact transaction amounts, wallet weights, and location variables—to centralized servers. This compromises financial privacy. **WalletShield solves this by performing transaction risk analysis on fully encrypted parameters using Fully Homomorphic Encryption (FHE) with machine learning.** The server checks for fraud risk blindly, without ever seeing or decrypting the raw data."*

---

## 🚶‍♂️ 2. Step-by-Step Demo Walkthrough (What to Show)

Follow this sequence during your live demo to show the system working E2E:

### Step 1: Connecting MetaMask
*   **Action:** Click **"Connect MetaMask"** in the top navbar.
*   **What is happening:** The React frontend connects to the local blockchain node (listening on Port `8545`). 
*   **Technical Detail to Mention:** *“Upon connection, the frontend immediately pings the local Client FHE Daemon (Port `5001`) to pre-generate and cache the FHE private and evaluation keys in memory. This ensures subsequent scans are fast and have zero latency.”*

### Step 2: Selecting / Pasting a Target Protocol
*   **Action:** Select **Aave V3 Pool** from the dropdown, or select **Paste Custom Contract Address** and paste a verified mainnet address (e.g., Uniswap Factory: `0x1F98431c8aD98523631AE4a59f267346ea31F984`).
*   **What is happening:** The frontend requests contract telemetry from the backend (Port `8000`).
*   **Technical Detail to Mention:** 
    *   *“For custom addresses, the backend dynamically queries Etherscan to fetch the verified source code, then runs a dynamic LLM security audit (with fail-safe regex fallback) to compute the **AI Code Vulnerability Score**.”*
    *   *“Notice the right panel updates with the security profile (Reentrancy attack vector, Admin key centralization, upgradeability proxy pattern). This represents public telemetry.”*

### Step 3: Entering Private Parameters & Running the FHE Scan
*   **Action:** Enter a **Staking Size** (e.g., `15000`) and adjust the **Portfolio Weight** slider to `20%`. Click **"Run Privacy Audit"**.
*   **What is happening:** Watch the scrolling logs in the cryptographic terminal viewer on the bottom right.
*   **Technical Detail to Mention (Crucial):**
    *   *“The client daemon normalizes my private features ($15,000$ staking size and $20\%$ portfolio weight) and encrypts them locally using Zama's `concrete-ml` library. **The private key never leaves my computer.**”*
    *   *“We transmit the encrypted **LWE Ciphertext** and the **Evaluation Key** to the backend FHE server. The server runs a 6-bit quantized Logistic Regression model directly on the encrypted bytes.”*
    *   *“The server outputs an encrypted prediction class and sends it back. The client daemon decrypts it locally to determine the final risk level (e.g., `LOW RISK`).”*

### Step 4: Signing & Committing the Audit Receipt
*   **Action:** Click **"Acknowledge Risk & Write to Ledger"**. Approve the single transaction popup in MetaMask.
*   **What is happening:** The transaction writes risk logs and user acknowledgments onto the blockchain.
*   **Technical Detail to Mention:** 
    *   *“We optimized this flow to consolidate risk acknowledgment (`PreTxGate.sol`) and audit logging (`RiskLog.sol`) into a single MetaMask transaction. The user only signs once.”*
    *   *“The blockchain stores the **SHA-256 hash of the encrypted ciphertext** along with the risk level. This establishes a tamper-proof audit trail. Anyone can verify that the transaction was scored correctly, but nobody can see the raw inputs ($15,000$ or $20\%$).”*

---

## 🛠️ 3. Core Technologies & Architecture (How it Works)

Use this table/list to answer architecture questions:

| Component | Port | Technology | Purpose |
| :--- | :---: | :--- | :--- |
| **Frontend UI** | `5173` | React 19, Vite, TailwindCSS | Connects MetaMask, inputs data, displays history. |
| **Client Daemon** | `5001` | FastAPI, Concrete ML | Secures the private key, handles encryption/decryption. |
| **Backend Oracle** | `8000` | FastAPI, Concrete ML, SQLite | Performs homomorphic inference on ciphertexts. |
| **Blockchain Node** | `8545` | Solidity `0.8.24`, Hardhat | Emulates Polygon Amoy for immutable logs. |

---

## ❓ 4. Mentor Q&A Cheat Sheet (Common Questions)

### Q1: Why does it use 6-bit quantization?
> **Answer:** Fully Homomorphic Encryption (FHE) is mathematically complex. To perform operations on ciphertexts, the weights of the machine learning model must be quantized. Using 6-bits (`n_bits=6`) strikes the perfect balance between FHE circuit execution speed (keeping noise levels in Torus FHE bounded) and prediction accuracy (which is evaluated at **96.55%**).

### Q2: Why did MetaMask use to ask for two approvals, and how did you optimize it?
> **Answer:** Initially, the frontend triggered two separate contract transactions back-to-back: one to `PreTxGate.sol` to record the user's risk acknowledgment, and a second to `RiskLog.sol` to log the ciphertext hash. 
> We optimized this by updating the contracts. `PreTxGate.sol` now contains a consolidated function `acknowledgeAndLog` that writes the acknowledgment state locally and calls the `RiskLog` contract internally via a nested cross-contract call. This reduces MetaMask prompts from two down to one, saves gas, and improves UX.

### Q3: What happens when you paste a MetaMask wallet address instead of a contract address?
> **Answer:** MetaMask addresses are EOAs (Externally Owned Accounts), which contain no bytecode or contract code on-chain. When pasted, the Etherscan query fetches nothing. WalletShield treats this as an **"Unverified Contract"** by default, automatically assigning it a high-risk rating as a safe default to prevent users from staking funds into a personal wallet address.

### Q4: How is the audit trail verified without revealing private data?
> **Answer:** The blockchain logs the `SHA-256` hash of the encrypted ciphertext. If an auditor wants to verify a transaction, they can request the client to disclose the plaintext parameters. The auditor can re-encrypt them locally, verify that the resulting ciphertext hash matches the hash recorded on-chain, and run the plaintext model to confirm that the server's output was correct. The server itself can never inspect or leak this data.

### Q5: Why is MetaMask displaying 'ETH' for gas fees instead of Polygon 'MATIC'?
> **Answer:** The project is architected for the Polygon Amoy Network (where MATIC is the native gas token). However, to run the demo locally with zero costs, high speed, and offline reliability, we run a local Hardhat Node. By default, Hardhat simulates the standard Ethereum Mainnet configuration, which uses **ETH** as the native currency symbol. MetaMask displays the gas fee in simulated test ETH (provided automatically for free by the Hardhat local node for development purposes).

### Q6: How does the "AI Audit Score Explanation" work under the hood, and how is it used in the FHE model?
> **Answer:** 
> 1. **Solidity Code Retrieval:** When you scan an address, the backend queries Etherscan to fetch the smart contract's verified Solidity source code.
> 2. **AI-Driven Vulnerability Audit:** The backend sends the first 10,000 characters of the Solidity code to Google Gemini. Gemini audits the code for vulnerabilities (like reentrancy attack vectors, centralization of admin keys, proxy upgradeability safety, and dangerous functions like `selfdestruct`). It outputs a qualitative analysis explanation (displayed in the UI) and a quantitative **Code Vulnerability Score (scaled between 0.0 and 1.0)**.
> 3. **Homomorphic Input:** This score becomes **Feature 6 (`contract_code_risk`)**. The local client daemon packages it with your private FHE inputs (amount and portfolio concentration) to compile a unified feature vector. This ensures the FHE ML model classifies risk based on both private user parameters and live contract security data.

---

## 🌟 5. Key Demo Features (What to Highlight)
Highlight these 6 core features to show a complete, robust system:
1.  **MetaMask Connection & RPC Routing:** Connects dynamically to the local blockchain node using Ethers.js, routing transactions directly via the user's browser.
2.  **On-the-Fly Contract Scanning:** Paste any custom Ethereum contract address to instantly trigger a verified source code retrieval and security analysis.
3.  **Local FHE Key Enclave:** Private keys are generated and cached in the client daemon (`localhost:5001`), ensuring that the model server has zero knowledge of the keys.
4.  **Blind Machine Learning Inference:** The backend server runs homomorphic Logistic Regression directly on encrypted feature vectors, returning an encrypted result.
5.  **Unified Blockchain Log Gatekeeper:** Writes transaction ciphertext hashes and risk scores on-chain, creating a decentralized and auditable security checklist.
6.  **Immutable Audit Verification Screen:** The ledger history page dynamically indexes past logs and allows you to view details of any audit receipt.

---

## 🛠️ 6. Major Backend Improvements Implemented
We implemented two significant production-grade improvements in the backend architecture:
1.  **Consolidated Smart Contract Gateway:**
    *   *Before:* The user had to click and approve two separate MetaMask transactions sequentially—one to `PreTxGate.sol` (acknowledgment) and one to `RiskLog.sol` (logging).
    *   *Improvement:* We modified `RiskLog.sol` to support delegated logging (`createLogForUser`) and updated `PreTxGate.sol` to act as a unified entry-point. Calling `PreTxGate.acknowledgeAndLog` now handles both actions in a **single transaction**, reducing MetaMask prompts to a single approval and cutting down gas fees.
2.  **Rate-Limit Fail-Safe (Heuristic Scanner Fallback):**
    *   *Before:* If the Google Gemini API free-tier hit a rate limit (429) during code analysis, the backend returned a 500 error, crashing the UI.
    *   *Improvement:* We corrected the analyzer workflow in `backend/analyzer.py`. The server now catches API exceptions gracefully and falls back to a local regex-based heuristic security scanner (assessing proxies, owners, and selfdestruct functions) to determine code risk without crashing.

---

## 🔍 7. The Crucial Role of Etherscan V2
Etherscan plays a vital role in our transaction scoring pipeline:
*   **Decentralized Source Repository:** Instead of forcing developers to upload contract source files manually, the backend uses **Etherscan V2 APIs** to fetch the verified smart contract source code dynamically.
*   **Verification Engine:** By validating that the bytecode matches verified Solidity code on Etherscan, the backend confirms the contract's legitimacy.
*   **Multi-Chain Compatibility:** It queries both **Ethereum Mainnet Etherscan** and **Arbitrum Arbiscan** APIs to support multi-chain contract evaluations.

