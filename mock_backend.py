"""
WalletShield Mock Backend Server
Simulates the FHE inference backend without requiring concrete-ml.
Replicates the exact same API contract as backend/main.py.
"""
import os
import uuid
import hashlib
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import json

# ── Lightweight .env loader ──────────────────────────────────────
def load_dotenv():
    for env_dir in [os.path.dirname(os.path.abspath(__file__))]:
        env_path = os.path.join(env_dir, ".env")
        if os.path.exists(env_path):
            print(f"Loading environment variables from: {env_path}")
            with open(env_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        os.environ[key.strip()] = val.strip().strip('"').strip("'")
            break

load_dotenv()

# Import the real analyzer (it has no concrete-ml dependency)
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from backend.analyzer import analyze_contract_address

# ── Pydantic Schemas (mirroring backend/schemas.py) ──────────────
class VerifyRequest(BaseModel):
    ciphertext: str
    eval_key: str
    wallet_address: str
    investment_range: str
    protocol_name: str

class VerifyResponse(BaseModel):
    encrypted_result: str
    id: str

class ConfirmRequest(BaseModel):
    id: str
    tx_hash: str
    risk_result: str

class CancelRequest(BaseModel):
    id: str

class HistoryResponse(BaseModel):
    id: str
    created_at: datetime
    protocol_name: str
    investment_range: str
    risk_result: Optional[str]
    blockchain_tx_hash: Optional[str]
    blockchain_confirmed: bool

class AnalyzeRequest(BaseModel):
    address: str

# ── In-Memory Database (replaces SQLite for simplicity) ──────────
verifications_db = {}

# ── App ──────────────────────────────────────────────────────────
app = FastAPI(title="WalletShield DeFi Risk Oracle Backend (Mock)", version="2.0.0-mock")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("=" * 60)
print("  WalletShield Mock Backend Server")
print("  FHE inference is SIMULATED (concrete-ml not required)")
print("=" * 60)

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/analyze-contract")
def analyze_contract(req: AnalyzeRequest):
    try:
        report = analyze_contract_address(req.address)
        return report
    except Exception as e:
        print(f"Contract analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze contract: {str(e)}")

@app.post("/api/verify", response_model=VerifyResponse)
def verify_transaction(req: VerifyRequest):
    """
    Simulates FHE inference. Instead of running homomorphic computation,
    we generate a mock encrypted result that the mock client daemon
    will interpret deterministically.
    """
    try:
        ciphertext_bytes = bytes.fromhex(req.ciphertext)
        ciphertext_hash = hashlib.sha256(ciphertext_bytes).hexdigest()

        # The mock "encrypted result" is just the ciphertext hash re-encoded
        # The mock client daemon will use this to produce a deterministic prediction
        mock_encrypted_result = hashlib.sha256(
            ciphertext_hash.encode() + b"server_inference"
        ).hexdigest()

        verification_id = str(uuid.uuid4())
        verifications_db[verification_id] = {
            "id": verification_id,
            "created_at": datetime.utcnow(),
            "wallet_address": req.wallet_address.lower(),
            "encrypted_payload_hash": ciphertext_hash,
            "risk_result": None,
            "investment_range": req.investment_range,
            "protocol_name": req.protocol_name,
            "blockchain_tx_hash": None,
            "blockchain_confirmed": False,
        }

        return VerifyResponse(
            encrypted_result=mock_encrypted_result,
            id=verification_id
        )
    except Exception as e:
        print(f"Mock inference error: {e}")
        raise HTTPException(status_code=500, detail=f"Inference execution failed: {str(e)}")

@app.post("/api/blockchain/confirm")
def confirm_blockchain_tx(req: ConfirmRequest):
    if req.id not in verifications_db:
        raise HTTPException(status_code=404, detail="Verification entry not found.")
    
    verifications_db[req.id]["blockchain_tx_hash"] = req.tx_hash
    verifications_db[req.id]["risk_result"] = req.risk_result.upper()
    verifications_db[req.id]["blockchain_confirmed"] = True
    return {"status": "confirmed", "id": req.id}

@app.post("/api/blockchain/cancel")
def cancel_blockchain_tx(req: CancelRequest):
    if req.id not in verifications_db:
        raise HTTPException(status_code=404, detail="Verification entry not found.")
    verifications_db[req.id]["risk_result"] = "CANCELLED"
    return {"status": "cancelled", "id": req.id}

@app.get("/api/history", response_model=List[HistoryResponse])
def get_transaction_history(wallet: str):
    records = [
        v for v in verifications_db.values()
        if v["wallet_address"] == wallet.lower()
    ]
    records.sort(key=lambda x: x["created_at"], reverse=True)
    return records

@app.get("/api/audit/{id}")
def get_audit_record(id: str):
    if id not in verifications_db:
        raise HTTPException(status_code=404, detail="Audit verification record not found.")
    record = verifications_db[id]
    return {
        "id": record["id"],
        "created_at": record["created_at"],
        "wallet_address": record["wallet_address"],
        "encrypted_payload_hash": record["encrypted_payload_hash"],
        "risk_result": record["risk_result"],
        "investment_range": record["investment_range"],
        "protocol_name": record["protocol_name"],
        "blockchain_tx_hash": record["blockchain_tx_hash"],
        "blockchain_confirmed": record["blockchain_confirmed"],
    }
