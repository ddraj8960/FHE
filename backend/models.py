import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime
from .database import Base

class Verification(Base):
    __tablename__ = "verifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow)
    wallet_address = Column(String, index=True, nullable=False)
    encrypted_payload_hash = Column(String, nullable=False)
    risk_result = Column(String, nullable=True)  # Populated during confirmation "LOW" | "MEDIUM" | "HIGH"
    risk_score_raw = Column(Float, nullable=True)
    blockchain_tx_hash = Column(String, nullable=True)
    blockchain_confirmed = Column(Boolean, default=False)
    amount_range = Column(String, nullable=False)  # Bucketed amount, e.g. "100-500"
    merchant_category = Column(String, nullable=False)

class FHESession(Base):
    __tablename__ = "fhe_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow)
    public_key_ref = Column(String, nullable=True)
    session_expires_at = Column(DateTime, nullable=False)
