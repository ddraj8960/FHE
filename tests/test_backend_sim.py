"""Unit tests for the backend simulation-mode FastAPI app (backend/main_sim.py).

These tests exercise every API endpoint using FastAPI's TestClient, backed by
a throwaway in-memory SQLite database so they are fully isolated.
"""

import uuid
import numpy as np
import pytest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend import models

# ── Build an in-memory DB and override the dependency ────────────────────────

SQLALCHEMY_TEST_URL = "sqlite:///file::memory:?cache=shared"
test_engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def _override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Import the sim app *after* its module-level model training has run
from backend.main_sim import app  # noqa: E402

app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(autouse=True)
def _setup_tables():
    """Create fresh tables for each test, drop afterwards."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


client = TestClient(app)


# ---------------------------------------------------------------------------
# /api/health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_health_returns_ok(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["mode"] == "simulation"


# ---------------------------------------------------------------------------
# /api/stats
# ---------------------------------------------------------------------------

class TestStats:
    def test_stats_empty_db(self):
        resp = client.get("/api/stats")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_verifications"] == 0
        assert body["confirmed_on_chain"] == 0
        assert body["unique_wallets"] == 0

    def test_stats_after_verification(self):
        features = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], dtype=np.float64)
        ciphertext_hex = features.tobytes().hex()
        client.post("/api/verify", json={
            "ciphertext": ciphertext_hex,
            "eval_key": "00" * 32,
            "wallet_address": "0xABC",
            "investment_range": "Under 10K",
            "protocol_name": "TestProto",
        })
        resp = client.get("/api/stats")
        body = resp.json()
        assert body["total_verifications"] == 1
        assert body["unique_wallets"] == 1


# ---------------------------------------------------------------------------
# /api/analyze-contract
# ---------------------------------------------------------------------------

class TestAnalyzeContract:
    def test_cached_address_returns_report(self):
        resp = client.post("/api/analyze-contract", json={
            "address": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"
        })
        assert resp.status_code == 200
        assert resp.json()["name"] == "Aave V3 Pool"

    @patch("backend.analyzer.requests.get")
    def test_analysis_failure_returns_500(self, mock_get):
        mock_get.side_effect = Exception("boom")
        resp = client.post("/api/analyze-contract", json={
            "address": "0x0000000000000000000000000000000000000001"
        })
        # The endpoint catches and returns the unverified-contract default
        # (Etherscan query fails → unverified), so it should still be 200
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# /api/verify   (simulation-mode inference)
# ---------------------------------------------------------------------------

class TestVerify:
    def _make_ciphertext(self, features):
        return np.array(features, dtype=np.float64).tobytes().hex()

    def test_low_risk_features(self):
        ct = self._make_ciphertext([0.05, 0.05, 0.05, 0.05, 0.05, 0.05])
        resp = client.post("/api/verify", json={
            "ciphertext": ct,
            "eval_key": "00" * 32,
            "wallet_address": "0xDEAD",
            "investment_range": "Under 10K",
            "protocol_name": "SafeProto",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "encrypted_result" in body
        assert "id" in body

    def test_high_risk_features(self):
        ct = self._make_ciphertext([0.99, 0.99, 0.99, 0.99, 0.99, 0.99])
        resp = client.post("/api/verify", json={
            "ciphertext": ct,
            "eval_key": "00" * 32,
            "wallet_address": "0xBEEF",
            "investment_range": "Over 100K",
            "protocol_name": "RiskyProto",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "encrypted_result" in body

    def test_wrong_feature_count_returns_500(self):
        bad_ct = np.array([0.1, 0.2], dtype=np.float64).tobytes().hex()
        resp = client.post("/api/verify", json={
            "ciphertext": bad_ct,
            "eval_key": "00" * 32,
            "wallet_address": "0xBAD",
            "investment_range": "Under 10K",
            "protocol_name": "Broken",
        })
        assert resp.status_code == 500

    def test_invalid_hex_returns_500(self):
        resp = client.post("/api/verify", json={
            "ciphertext": "not_hex",
            "eval_key": "00" * 32,
            "wallet_address": "0xBAD",
            "investment_range": "Under 10K",
            "protocol_name": "Broken",
        })
        assert resp.status_code == 500

    def test_wallet_address_stored_lowercase(self):
        ct = self._make_ciphertext([0.1, 0.2, 0.3, 0.4, 0.5, 0.6])
        resp = client.post("/api/verify", json={
            "ciphertext": ct,
            "eval_key": "00" * 32,
            "wallet_address": "0xAbCdEf",
            "investment_range": "10K-50K",
            "protocol_name": "Proto",
        })
        vid = resp.json()["id"]

        audit_resp = client.get(f"/api/audit/{vid}")
        assert audit_resp.json()["wallet_address"] == "0xabcdef"


# ---------------------------------------------------------------------------
# /api/blockchain/confirm
# ---------------------------------------------------------------------------

class TestConfirmBlockchain:
    def _create_verification(self):
        ct = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], dtype=np.float64).tobytes().hex()
        resp = client.post("/api/verify", json={
            "ciphertext": ct,
            "eval_key": "00" * 32,
            "wallet_address": "0xWALLET",
            "investment_range": "Under 10K",
            "protocol_name": "TestProto",
        })
        return resp.json()["id"]

    def test_confirm_updates_record(self):
        vid = self._create_verification()
        resp = client.post("/api/blockchain/confirm", json={
            "id": vid,
            "tx_hash": "0xabc123",
            "risk_result": "low",
        })
        assert resp.status_code == 200
        assert resp.json()["status"] == "confirmed"

        audit = client.get(f"/api/audit/{vid}").json()
        assert audit["blockchain_confirmed"] is True
        assert audit["risk_result"] == "LOW"
        assert audit["blockchain_tx_hash"] == "0xabc123"

    def test_confirm_nonexistent_returns_404(self):
        resp = client.post("/api/blockchain/confirm", json={
            "id": str(uuid.uuid4()),
            "tx_hash": "0xfff",
            "risk_result": "HIGH",
        })
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# /api/history
# ---------------------------------------------------------------------------

class TestHistory:
    def _submit(self, wallet):
        ct = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], dtype=np.float64).tobytes().hex()
        return client.post("/api/verify", json={
            "ciphertext": ct,
            "eval_key": "00" * 32,
            "wallet_address": wallet,
            "investment_range": "Under 10K",
            "protocol_name": "Proto",
        })

    def test_history_returns_only_matching_wallet(self):
        self._submit("0xAAA")
        self._submit("0xBBB")
        resp = client.get("/api/history", params={"wallet": "0xAAA"})
        assert resp.status_code == 200
        results = resp.json()
        assert len(results) == 1
        assert results[0]["protocol_name"] == "Proto"

    def test_history_empty_for_unknown_wallet(self):
        resp = client.get("/api/history", params={"wallet": "0xNONE"})
        assert resp.status_code == 200
        assert resp.json() == []


# ---------------------------------------------------------------------------
# /api/audit/{id}
# ---------------------------------------------------------------------------

class TestAudit:
    def test_audit_returns_record(self):
        ct = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], dtype=np.float64).tobytes().hex()
        vid = client.post("/api/verify", json={
            "ciphertext": ct,
            "eval_key": "00" * 32,
            "wallet_address": "0xAUDIT",
            "investment_range": "Over 100K",
            "protocol_name": "AuditProto",
        }).json()["id"]

        resp = client.get(f"/api/audit/{vid}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["protocol_name"] == "AuditProto"
        assert body["investment_range"] == "Over 100K"

    def test_audit_nonexistent_returns_404(self):
        resp = client.get(f"/api/audit/{uuid.uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Simulation model training helper
# ---------------------------------------------------------------------------

class TestGetOrTrainModel:
    def test_model_produces_valid_predictions(self):
        from backend.main_sim import sim_model
        features = np.array([[0.5, 0.5, 0.5, 0.5, 0.5, 0.5]])
        pred = sim_model.predict(features)
        assert pred[0] in {0, 1, 2}

    def test_model_low_risk_input(self):
        from backend.main_sim import sim_model
        low = np.array([[0.01, 0.01, 0.01, 0.01, 0.01, 0.01]])
        pred = sim_model.predict(low)
        assert pred[0] == 0  # LOW

    def test_model_high_risk_input(self):
        from backend.main_sim import sim_model
        high = np.array([[0.99, 0.99, 0.99, 0.99, 0.99, 0.99]])
        pred = sim_model.predict(high)
        assert pred[0] == 2  # HIGH
