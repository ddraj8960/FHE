from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class VerifyRequest(BaseModel):
    ciphertext: str          # hex encoded bytes
    eval_key: str            # hex encoded bytes
    wallet_address: str
    investment_range: str
    protocol_name: str

class VerifyResponse(BaseModel):
    encrypted_result: str    # hex encoded bytes
    id: str

class ConfirmRequest(BaseModel):
    id: str
    tx_hash: str
    risk_result: str

class HistoryResponse(BaseModel):
    id: str
    created_at: datetime
    protocol_name: str
    investment_range: str
    risk_result: Optional[str]
    blockchain_tx_hash: Optional[str]
    blockchain_confirmed: bool

    class Config:
        orm_mode = True
        from_attributes = True

class CancelRequest(BaseModel):
    id: str

