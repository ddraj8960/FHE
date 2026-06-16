import os
import uuid
import hashlib
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel

from . import models, schemas, database
from .analyzer import analyze_contract_address
from concrete.ml.deployment import FHEModelServer

# Initialize DB tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="WalletShield DeFi Risk Oracle Backend", version="2.0.0")

# Setup CORS so the React frontend can communicate with the server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Concrete ML FHE Model Server (configured for 6-feature DeFi model)
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fhe", "compiled_model")
if not os.path.exists(MODEL_DIR):
    raise RuntimeError(f"FHE model directory not found at {MODEL_DIR}. Train the model first.")

print(f"Loading FHE model server from: {MODEL_DIR}")
fhe_server = FHEModelServer(path_dir=MODEL_DIR)
fhe_server.load()
print("FHE model server loaded successfully.")

class AnalyzeRequest(BaseModel):
    address: str

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/analyze-contract")
def analyze_contract(req: AnalyzeRequest):
    """
    Endpoint to dynamically analyze an arbitrary smart contract.
    Queries Etherscan and audits the code via LLM.
    """
    try:
        report = analyze_contract_address(req.address)
        return report
    except Exception as e:
        print(f"Contract analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze contract: {str(e)}")

@app.post("/api/verify", response_model=schemas.VerifyResponse)
def verify_transaction(req: schemas.VerifyRequest, db: Session = Depends(database.get_db)):
    """
    Submit FHE ciphertext (comprising encrypted private features) for server blind inference.
    Combine with public features server-side if needed (the client compiles the full 6-feature vector).
    """
    try:
        # Convert hex inputs to bytes
        ciphertext_bytes = bytes.fromhex(req.ciphertext)
        eval_key_bytes = bytes.fromhex(req.eval_key)
        
        # Calculate SHA256 of the ciphertext to act as the on-chain audit log registry hash
        ciphertext_hash = hashlib.sha256(ciphertext_bytes).hexdigest()
        
        # Execute homomorphic prediction (inference) on the server on ciphertext
        # Server does not have access to the secret key, nor does it see plaintext features
        encrypted_result_bytes = fhe_server.run(ciphertext_bytes, eval_key_bytes)
        
        # Create a database record
        verification_id = str(uuid.uuid4())
        db_verification = models.Verification(
            id=verification_id,
            wallet_address=req.wallet_address.lower(),
            encrypted_payload_hash=ciphertext_hash,
            investment_range=req.investment_range,
            protocol_name=req.protocol_name,
            blockchain_confirmed=False
        )
        db.add(db_verification)
        db.commit()
        
        return schemas.VerifyResponse(
            encrypted_result=encrypted_result_bytes.hex(),
            id=verification_id
        )
        
    except Exception as e:
        print(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail=f"Inference execution failed: {str(e)}")

@app.post("/api/blockchain/confirm")
def confirm_blockchain_tx(req: schemas.ConfirmRequest, db: Session = Depends(database.get_db)):
    db_verification = db.query(models.Verification).filter(models.Verification.id == req.id).first()
    if not db_verification:
        raise HTTPException(status_code=404, detail="Verification entry not found.")
    
    db_verification.blockchain_tx_hash = req.tx_hash
    db_verification.risk_result = req.risk_result.upper()
    db_verification.blockchain_confirmed = True
    db.commit()
    return {"status": "confirmed", "id": req.id}

@app.get("/api/history", response_model=List[schemas.HistoryResponse])
def get_transaction_history(wallet: str, db: Session = Depends(database.get_db)):
    # Fetch historical records for the connected wallet (case insensitive check)
    records = db.query(models.Verification).filter(
        models.Verification.wallet_address == wallet.lower()
    ).order_by(models.Verification.created_at.desc()).all()
    return records

@app.get("/api/audit/{id}")
def get_audit_record(id: str, db: Session = Depends(database.get_db)):
    record = db.query(models.Verification).filter(models.Verification.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Audit verification record not found.")
    
    # Return the record. Note that exact investment amount, FHE keys, location risks, etc., are never stored server-side.
    return {
        "id": record.id,
        "created_at": record.created_at,
        "wallet_address": record.wallet_address,
        "encrypted_payload_hash": record.encrypted_payload_hash,
        "risk_result": record.risk_result,
        "investment_range": record.investment_range,
        "protocol_name": record.protocol_name,
        "blockchain_tx_hash": record.blockchain_tx_hash,
        "blockchain_confirmed": record.blockchain_confirmed
    }
