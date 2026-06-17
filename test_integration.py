import os
import sys
import requests
import json
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shared.risk import RISK_LABELS

BACKEND_URL = "http://localhost:8000"
CLIENT_DAEMON_URL = "http://localhost:5001"

def run_integration_test():
    print("=== STARTING WALLETSHIELD E2E INTEGRATION TEST ===")
    
    # Step 1: Scan target protocol
    target_address = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" # Aave V3 Pool
    print(f"\n[Step 1] Requesting contract analysis for address: {target_address}...")
    
    res = requests.post(f"{BACKEND_URL}/api/analyze-contract", json={"address": target_address})
    if res.status_code != 200:
        print(f"Error: Contract analysis failed: {res.text}")
        return False
    
    report = res.json()
    print(f"Analysis Report Received:")
    print(f" - Name: {report.get('name')}")
    print(f" - Risk Score (Feature 2): {report.get('protocol_risk_score')}")
    print(f" - Verification Status (Feature 3): {report.get('contract_verification')}")
    print(f" - Maturity (Feature 5): {report.get('protocol_maturity')}")
    print(f" - AI Code Risk (Feature 6): {report.get('contract_code_risk')}")
    
    # Step 2: Encrypt inputs on local client daemon
    # Inputs:
    # 1. amount: 15,000 USD (normalized to 15000 / 100000 = 0.15)
    # 4. portfolio concentration: 15% (normalized to 0.15)
    amount_norm = 0.15
    portfolio_conc_norm = 0.15
    
    features = [
        amount_norm,
        report['protocol_risk_score'],
        report['contract_verification'],
        portfolio_conc_norm,
        report['protocol_maturity'],
        report['contract_code_risk']
    ]
    
    print(f"\n[Step 2] Sending feature vector {features} to local FHE daemon for encryption...")
    start_time = time.time()
    res = requests.post(f"{CLIENT_DAEMON_URL}/api/client/encrypt", json={"features": features})
    if res.status_code != 200:
        print(f"Error: Encryption daemon failed: {res.text}")
        return False
    
    encrypt_data = res.json()
    ciphertext = encrypt_data['ciphertext']
    eval_key = encrypt_data['eval_key']
    ciphertext_hash = encrypt_data['ciphertext_hash']
    
    print(f"Encryption completed in {time.time() - start_time:.2f}s.")
    print(f" - Ciphertext Hash: {ciphertext_hash}")
    print(f" - Ciphertext Length: {len(ciphertext)} bytes")
    print(f" - Evaluation Key Length: {len(eval_key)} bytes")
    
    # Step 3: Run blind inference on backend
    print(f"\n[Step 3] Sending encrypted ciphertext to backend for blind homomorphic inference...")
    start_time = time.time()
    res = requests.post(f"{BACKEND_URL}/api/verify", json={
        "ciphertext": ciphertext,
        "eval_key": eval_key,
        "wallet_address": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", # Hardhat Account #0
        "investment_range": "10K-50K",
        "protocol_name": report['name']
    })
    
    if res.status_code != 200:
        print(f"Error: Backend inference failed: {res.text}")
        return False
        
    verify_data = res.json()
    encrypted_result = verify_data['encrypted_result']
    verification_id = verify_data['id']
    
    print(f"Server-blind FHE inference completed in {time.time() - start_time:.2f}s.")
    print(f" - Verification ID: {verification_id}")
    print(f" - Encrypted Result Length: {len(encrypted_result)} bytes")
    
    # Step 4: Decrypt result locally
    print(f"\n[Step 4] Decrypting prediction locally using FHE daemon...")
    res = requests.post(f"{CLIENT_DAEMON_URL}/api/client/decrypt", json={
        "encrypted_result": encrypted_result
    })
    if res.status_code != 200:
        print(f"Error: Decryption daemon failed: {res.text}")
        return False
        
    decrypt_data = res.json()
    prediction = decrypt_data['prediction']
    final_risk = RISK_LABELS.get(prediction, "UNKNOWN")
    
    print(f"Decryption successful!")
    print(f" => Predicted Risk Level: {final_risk} (Model Prediction Class: {prediction})")
    
    print("\n=== E2E INTEGRATION TEST SUCCESSFUL ===")
    return True

if __name__ == "__main__":
    run_integration_test()
