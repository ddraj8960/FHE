import os
import sys
import hashlib
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shared.cors import add_cors_middleware

from concrete.ml.deployment import FHEModelClient

app = FastAPI(title="WalletShield Client FHE Daemon", version="1.0.0")
add_cors_middleware(app)

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fhe", "compiled_model")
if not os.path.exists(MODEL_DIR):
    raise RuntimeError(f"Compiled client FHE artifacts not found at {MODEL_DIR}. Please compile the FHE model first.")

print(f"Loading Client FHE Model specs from: {MODEL_DIR}")
fhe_client = FHEModelClient(path_dir=MODEL_DIR)
fhe_client.load()
print("Client FHE Model specs loaded successfully.")

# Cache keys in memory so we don't regenerate them on every transaction
cached_keys = {
    "generated": False,
    "eval_key_hex": ""
}

class EncryptRequest(BaseModel):
    features: List[float]

class DecryptRequest(BaseModel):
    encrypted_result: str  # hex encoded bytes

@app.get("/api/client/health")
def health_check():
    return {"status": "ok", "keys_generated": cached_keys["generated"]}

@app.post("/api/client/keys")
def generate_keys():
    try:
        if not cached_keys["generated"]:
            print("Generating FHE private and evaluation keys (this may take a few seconds)...")
            fhe_client.generate_private_and_evaluation_keys()
            
            # Serialize evaluation keys to send to the server
            eval_key_bytes = fhe_client.get_serialized_evaluation_keys()
            cached_keys["eval_key_hex"] = eval_key_bytes.hex()
            cached_keys["generated"] = True
            print("Keys generated and cached successfully.")
        
        return {"status": "keys_ready", "eval_key": cached_keys["eval_key_hex"]}
    except Exception as e:
        print(f"Key generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Key generation failed: {str(e)}")

@app.post("/api/client/encrypt")
def encrypt_features(req: EncryptRequest):
    try:
        # Check if keys are ready, otherwise generate
        if not cached_keys["generated"]:
            generate_keys()
        
        # Convert features to 2D numpy array
        x = np.array([req.features])
        
        # Encrypt and serialize features
        ciphertext_bytes = fhe_client.quantize_encrypt_serialize(x)
        
        # Calculate SHA256 of the ciphertext (to be used as the blockchain payload hash)
        ciphertext_hash = hashlib.sha256(ciphertext_bytes).hexdigest()
        
        return {
            "ciphertext": ciphertext_bytes.hex(),
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
        
        # Convert hex result to bytes
        encrypted_result_bytes = bytes.fromhex(req.encrypted_result)
        
        # Decrypt result using secret key
        res = fhe_client.deserialize_decrypt_dequantize(encrypted_result_bytes)
        print(f"Decrypted model output raw shape {res.shape}: {res}")
        
        # Parse prediction robustly
        if len(res.shape) > 1 and res.shape[1] > 1:
            # Multi-class probabilities or decision functions, get argmax
            prediction = int(res[0].argmax())
        else:
            # Direct class label
            prediction = int(res.flatten()[0])
            
        return {"prediction": prediction}
    except Exception as e:
        print(f"Decryption failed: {e}")
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")
