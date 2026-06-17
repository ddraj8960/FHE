import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from concrete.ml.sklearn import LogisticRegression
from concrete.ml.deployment import FHEModelDev
import os
import sys
import shutil

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.risk import generate_synthetic_dataset

def main():
    print("--- Phase 2: Generating DeFi Synthetic Dataset ---")

    X, y = generate_synthetic_dataset(n_samples=10000, seed=42)

    # Check label balance
    unique, counts = np.unique(y, return_counts=True)
    print(f"Class distribution: {dict(zip(unique, counts))}")

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
