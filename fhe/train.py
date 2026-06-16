import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from concrete.ml.sklearn import LogisticRegression
from concrete.ml.deployment import FHEModelDev
import os
import shutil

def main():
    print("--- Phase 2: Generating DeFi Synthetic Dataset ---")
    n_samples = 10000
    np.random.seed(42)

    # Features:
    # 1. investment_amount (0.0 to 1.0, private FHE) - User staking amount normalized against $100K
    # 2. protocol_risk_score (0.0 to 1.0, public) - General risk score (TVL, market cap, audits)
    # 3. contract_verification (0.0 to 1.0, public) - Source verification & proxy status
    # 4. portfolio_concentration (0.0 to 1.0, private FHE) - % of user portfolio in this staking pool
    # 5. protocol_maturity (0.0 to 1.0, public) - Inverse of contract age (newer = higher risk)
    # 6. contract_code_risk (0.0 to 1.0, public) - Dynamic AI audit vulnerability score

    investment_amount = np.random.uniform(0.0, 1.0, n_samples)
    protocol_risk = np.random.uniform(0.0, 1.0, n_samples)
    contract_verification = np.random.uniform(0.0, 1.0, n_samples)
    portfolio_conc = np.random.uniform(0.0, 1.0, n_samples)
    protocol_maturity = np.random.uniform(0.0, 1.0, n_samples)
    contract_code_risk = np.random.uniform(0.0, 1.0, n_samples)

    # Heuristic formula for risk score (0.0 to 1.0)
    raw_risk = (
        0.25 * investment_amount +
        0.20 * protocol_risk +
        0.15 * contract_verification +
        0.15 * portfolio_conc +
        0.10 * protocol_maturity +
        0.15 * contract_code_risk
    )

    # Label classification:
    # 0 = LOW risk (raw_risk < 0.40)
    # 1 = MEDIUM risk (0.40 <= raw_risk < 0.62)
    # 2 = HIGH risk (raw_risk >= 0.62)
    labels = np.zeros(n_samples, dtype=int)
    labels[raw_risk >= 0.40] = 1
    labels[raw_risk >= 0.62] = 2

    # Check label balance
    unique, counts = np.unique(labels, return_counts=True)
    print(f"Class distribution: {dict(zip(unique, counts))}")

    X = np.stack([
        investment_amount, 
        protocol_risk, 
        contract_verification, 
        portfolio_conc, 
        protocol_maturity, 
        contract_code_risk
    ], axis=1)
    y = labels

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("\n--- Training Quantized 6-Feature Logistic Regression Model ---")
    # Using 6-bit quantization as per FHE constraints
    model = LogisticRegression(n_bits=6)
    model.fit(X_train, y_train)

    print("\n--- Compiling model to FHE circuit ---")
    model.compile(X_train)
    print("Compilation successful.")

    # Evaluate accuracy in plaintext vs. simulation
    y_pred = model.predict(X_test)
    accuracy = (y_pred == y_test).mean()
    print(f"Plaintext prediction accuracy on test set: {accuracy * 100:.2f}%")

    # Save compiled model artifacts
    export_dir = os.path.join(os.path.dirname(__file__), "compiled_model")
    if os.path.exists(export_dir):
        shutil.rmtree(export_dir)
    os.makedirs(export_dir, exist_ok=True)

    print(f"\n--- Serializing and saving FHE deployment files to {export_dir} ---")
    fhe_dev = FHEModelDev(path_dir=export_dir, model=model)
    fhe_dev.save()
    print("FHEModelDev save successful. client.zip and server.zip generated.")

if __name__ == "__main__":
    main()
