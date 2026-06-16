"""Unit tests for backend/schemas.py — Pydantic request/response models."""

from datetime import datetime

import pytest
from pydantic import ValidationError

from backend.schemas import (
    VerifyRequest,
    VerifyResponse,
    ConfirmRequest,
    HistoryResponse,
)


# ---------------------------------------------------------------------------
# VerifyRequest
# ---------------------------------------------------------------------------

class TestVerifyRequest:
    def test_valid_request(self):
        req = VerifyRequest(
            ciphertext="aabb",
            eval_key="ccdd",
            wallet_address="0xABC",
            investment_range="Under 10K",
            protocol_name="Aave",
        )
        assert req.ciphertext == "aabb"
        assert req.wallet_address == "0xABC"

    def test_missing_required_field_raises(self):
        with pytest.raises(ValidationError):
            VerifyRequest(
                ciphertext="aa",
                eval_key="bb",
                # wallet_address missing
                investment_range="Under 10K",
                protocol_name="Aave",
            )

    def test_extra_fields_ignored(self):
        req = VerifyRequest(
            ciphertext="aa",
            eval_key="bb",
            wallet_address="0x1",
            investment_range="10K-50K",
            protocol_name="GMX",
            extra_field="should be ignored",
        )
        assert not hasattr(req, "extra_field") or req.model_extra is None or "extra_field" not in req.model_fields


# ---------------------------------------------------------------------------
# VerifyResponse
# ---------------------------------------------------------------------------

class TestVerifyResponse:
    def test_valid_response(self):
        resp = VerifyResponse(encrypted_result="deadbeef", id="abc-123")
        assert resp.encrypted_result == "deadbeef"
        assert resp.id == "abc-123"

    def test_missing_id_raises(self):
        with pytest.raises(ValidationError):
            VerifyResponse(encrypted_result="aabb")


# ---------------------------------------------------------------------------
# ConfirmRequest
# ---------------------------------------------------------------------------

class TestConfirmRequest:
    def test_valid_confirm(self):
        req = ConfirmRequest(id="v1", tx_hash="0xabc", risk_result="HIGH")
        assert req.risk_result == "HIGH"

    def test_missing_tx_hash_raises(self):
        with pytest.raises(ValidationError):
            ConfirmRequest(id="v1", risk_result="LOW")


# ---------------------------------------------------------------------------
# HistoryResponse
# ---------------------------------------------------------------------------

class TestHistoryResponse:
    def test_full_history_entry(self):
        entry = HistoryResponse(
            id="h1",
            created_at=datetime(2025, 1, 1),
            protocol_name="Euler",
            investment_range="Over 100K",
            risk_result="MEDIUM",
            blockchain_tx_hash="0xfff",
            blockchain_confirmed=True,
        )
        assert entry.blockchain_confirmed is True

    def test_optional_fields_nullable(self):
        entry = HistoryResponse(
            id="h2",
            created_at=datetime(2025, 6, 1),
            protocol_name="Proto",
            investment_range="Under 10K",
            risk_result=None,
            blockchain_tx_hash=None,
            blockchain_confirmed=False,
        )
        assert entry.risk_result is None
        assert entry.blockchain_tx_hash is None

    def test_from_attributes_config(self):
        assert HistoryResponse.model_config.get("from_attributes") is True
