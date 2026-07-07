"""
WalletShield Mock Client FHE Daemon
Simulates the local FHE key generation, encryption, and decryption
without requiring concrete-ml. Replicates the exact API contract.
"""
import os
import hashlib
import json
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI(title="WalletShield Client FHE Daemon (Mock)", version="1.0.0-mock")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("=" * 60)
print("  WalletShield Mock Client FHE Daemon")
print("  FHE encryption is SIMULATED (concrete-ml not required)")
print("=" * 60)

# Cache for simulated keys
cached_keys = {
    "generated": False,
    "eval_key_hex": ""
}

# Store last encrypted features for deterministic decryption
last_encrypted_features = {}

class EncryptRequest(BaseModel):
    features: List[float]

class DecryptRequest(BaseModel):
    encrypted_result: str  # hex encoded

@app.get("/api/client/health")
def health_check():
    return {"status": "ok", "keys_generated": cached_keys["generated"]}

@app.post("/api/client/keys")
def generate_keys():
    try:
        if not cached_keys["generated"]:
            print("Generating simulated FHE private and evaluation keys...")
            # Simulate key generation with deterministic fake keys
            fake_private_key = hashlib.sha256(f"fhe_private_key_{time.time()}".encode()).hexdigest()
            fake_eval_key = hashlib.sha256(f"fhe_eval_key_{fake_private_key}".encode()).hexdigest()
            # Make eval key look realistic (repeat to simulate large key size)
            cached_keys["eval_key_hex"] = fake_eval_key * 16  # ~1KB hex string
            cached_keys["generated"] = True
            print("Simulated keys generated and cached successfully.")
        
        return {"status": "keys_ready", "eval_key": cached_keys["eval_key_hex"]}
    except Exception as e:
        print(f"Key generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Key generation failed: {str(e)}")

@app.post("/api/client/encrypt")
def encrypt_features(req: EncryptRequest):
    try:
        if not cached_keys["generated"]:
            generate_keys()
        
        features = req.features
        print(f"Encrypting features (simulated): {features}")
        
        # Simulate encryption: encode features as a deterministic hex blob
        feature_str = json.dumps(features)
        ciphertext_bytes = hashlib.sha256(feature_str.encode()).digest()
        # Make ciphertext look realistic in size
        ciphertext_hex = ciphertext_bytes.hex() * 4

        ciphertext_hash = hashlib.sha256(bytes.fromhex(ciphertext_hex)).hexdigest()

        # Store features for later decryption simulation
        last_encrypted_features[ciphertext_hash] = features

        return {
            "ciphertext": ciphertext_hex,
            "eval_key": cached_keys["eval_key_hex"],
            "ciphertext_hash": ciphertext_hash
        }
    except Exception as e:
        print(f"Encryption failed: {e}")
        raise HTTPException(status_code=500, detail=f"Encryption failed: {str(e)}")

@app.post("/api/client/decrypt")
def decrypt_result(req: DecryptRequest):
    try:
        if not cached_keys["generated"]:
            raise HTTPException(status_code=400, detail="Keys are not generated. Cannot decrypt.")
        
        print(f"Decrypting result (simulated)...")
        
        # Determine prediction based on the stored features
        # Use the risk scoring formula from the README:
        # raw_risk = 0.30×amount + 0.25×merchant + 0.20×device + 0.15×freq + 0.10×location
        # For 6 features: weighted scoring based on feature values
        
        # Find the matching features from stored data
        prediction = 0  # default LOW
        
        if last_encrypted_features:
            # Get the most recent features
            latest_key = list(last_encrypted_features.keys())[-1]
            features = last_encrypted_features[latest_key]
            
            if len(features) >= 5:
                # Use the risk scoring weights from the project
                # Features: [amount_norm, protocol_risk, contract_verif, device_trust, protocol_maturity, code_risk]
                if len(features) >= 6:
                    raw_risk = (
                        0.20 * features[0] +  # amount
                        0.20 * features[1] +  # protocol risk
                        0.15 * features[2] +  # contract verification
                        0.15 * features[3] +  # device trust risk
                        0.15 * features[4] +  # protocol maturity
                        0.15 * features[5]    # contract code risk
                    )
                else:
                    raw_risk = (
                        0.30 * features[0] +
                        0.25 * features[1] +
                        0.20 * features[2] +
                        0.15 * features[3] +
                        0.10 * features[4]
                    )
                
                print(f"  Features: {features}")
                print(f"  Raw risk score: {raw_risk:.4f}")
                
                if raw_risk < 0.40:
                    prediction = 0  # LOW
                elif raw_risk < 0.62:
                    prediction = 1  # MEDIUM
                else:
                    prediction = 2  # HIGH
                    
                print(f"  Prediction class: {prediction} ({'LOW' if prediction == 0 else 'MEDIUM' if prediction == 1 else 'HIGH'})")
        
        return {"prediction": prediction}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Decryption failed: {e}")
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")
