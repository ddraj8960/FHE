"""Unit tests for the client FHE simulation daemon (client_fhe/main_sim.py).

Covers key generation, encryption, and decryption endpoints.
"""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from client_fhe.main_sim import app, cached_keys

client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset_key_state():
    """Reset simulated key cache between tests."""
    cached_keys["generated"] = False
    cached_keys["eval_key_hex"] = "sim_eval_key_placeholder_" + "0" * 64
    yield


# ---------------------------------------------------------------------------
# /api/client/health
# ---------------------------------------------------------------------------

class TestClientHealth:
    def test_health_returns_ok(self):
        resp = client.get("/api/client/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["mode"] == "simulation"

    def test_health_reflects_key_state(self):
        resp = client.get("/api/client/health")
        assert resp.json()["keys_generated"] is False

        client.post("/api/client/keys")
        resp = client.get("/api/client/health")
        assert resp.json()["keys_generated"] is True


# ---------------------------------------------------------------------------
# /api/client/keys
# ---------------------------------------------------------------------------

class TestGenerateKeys:
    def test_keys_generated_successfully(self):
        resp = client.post("/api/client/keys")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "keys_ready"
        assert "eval_key" in body
        assert len(body["eval_key"]) > 0

    def test_keys_idempotent(self):
        resp1 = client.post("/api/client/keys")
        resp2 = client.post("/api/client/keys")
        assert resp1.json()["eval_key"] == resp2.json()["eval_key"]


# ---------------------------------------------------------------------------
# /api/client/encrypt
# ---------------------------------------------------------------------------

class TestEncryptFeatures:
    def test_encrypt_six_features(self):
        resp = client.post("/api/client/encrypt", json={
            "features": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "ciphertext" in body
        assert "eval_key" in body
        assert "ciphertext_hash" in body
        assert len(body["ciphertext_hash"]) == 64  # SHA-256 hex

    def test_encrypt_auto_generates_keys(self):
        assert cached_keys["generated"] is False
        resp = client.post("/api/client/encrypt", json={
            "features": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
        })
        assert resp.status_code == 200
        assert cached_keys["generated"] is True

    def test_encrypt_wrong_feature_count_returns_400(self):
        resp = client.post("/api/client/encrypt", json={
            "features": [0.1, 0.2, 0.3]
        })
        assert resp.status_code == 400

    def test_ciphertext_round_trips_to_original_features(self):
        features = [0.11, 0.22, 0.33, 0.44, 0.55, 0.66]
        resp = client.post("/api/client/encrypt", json={"features": features})
        ct_hex = resp.json()["ciphertext"]
        recovered = np.frombuffer(bytes.fromhex(ct_hex), dtype=np.float64)
        np.testing.assert_allclose(recovered, features)

    def test_different_inputs_produce_different_ciphertexts(self):
        r1 = client.post("/api/client/encrypt", json={
            "features": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
        })
        r2 = client.post("/api/client/encrypt", json={
            "features": [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]
        })
        assert r1.json()["ciphertext"] != r2.json()["ciphertext"]
        assert r1.json()["ciphertext_hash"] != r2.json()["ciphertext_hash"]


# ---------------------------------------------------------------------------
# /api/client/decrypt
# ---------------------------------------------------------------------------

class TestDecryptResult:
    def test_decrypt_low_risk(self):
        client.post("/api/client/keys")
        prediction = (0).to_bytes(4, "little").hex()
        resp = client.post("/api/client/decrypt", json={
            "encrypted_result": prediction
        })
        assert resp.status_code == 200
        assert resp.json()["prediction"] == 0

    def test_decrypt_medium_risk(self):
        client.post("/api/client/keys")
        prediction = (1).to_bytes(4, "little").hex()
        resp = client.post("/api/client/decrypt", json={
            "encrypted_result": prediction
        })
        assert resp.json()["prediction"] == 1

    def test_decrypt_high_risk(self):
        client.post("/api/client/keys")
        prediction = (2).to_bytes(4, "little").hex()
        resp = client.post("/api/client/decrypt", json={
            "encrypted_result": prediction
        })
        assert resp.json()["prediction"] == 2

    def test_decrypt_without_keys_returns_400(self):
        prediction = (0).to_bytes(4, "little").hex()
        resp = client.post("/api/client/decrypt", json={
            "encrypted_result": prediction
        })
        assert resp.status_code == 400

    def test_decrypt_invalid_hex_returns_500(self):
        client.post("/api/client/keys")
        resp = client.post("/api/client/decrypt", json={
            "encrypted_result": "not_valid_hex"
        })
        assert resp.status_code == 500
