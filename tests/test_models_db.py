"""Unit tests for backend/models.py and backend/database.py.

Uses an in-memory SQLite database to verify ORM model behaviour and the
get_db dependency generator.
"""

from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.models import Verification, FHESession

# ── In-memory engine for isolation ──────────────────────────────────────────

TEST_URL = "sqlite:///file:test_models?mode=memory&cache=shared&uri=true"
engine = create_engine(TEST_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def _setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# Table creation
# ---------------------------------------------------------------------------

class TestTableCreation:
    def test_verifications_table_exists(self):
        inspector = inspect(engine)
        assert "verifications" in inspector.get_table_names()

    def test_fhe_sessions_table_exists(self):
        inspector = inspect(engine)
        assert "fhe_sessions" in inspector.get_table_names()


# ---------------------------------------------------------------------------
# Verification model
# ---------------------------------------------------------------------------

class TestVerificationModel:
    def test_create_verification(self):
        db = TestSession()
        v = Verification(
            id="v-1",
            wallet_address="0xabc",
            encrypted_payload_hash="hash123",
            investment_range="Under 10K",
            protocol_name="Aave",
        )
        db.add(v)
        db.commit()
        db.refresh(v)

        assert v.id == "v-1"
        assert v.blockchain_confirmed is False
        assert v.risk_result is None
        assert isinstance(v.created_at, datetime)
        db.close()

    def test_update_verification_after_confirm(self):
        db = TestSession()
        v = Verification(
            id="v-2",
            wallet_address="0xdef",
            encrypted_payload_hash="hash456",
            investment_range="10K-50K",
            protocol_name="GMX",
        )
        db.add(v)
        db.commit()

        v.risk_result = "HIGH"
        v.blockchain_tx_hash = "0xtx"
        v.blockchain_confirmed = True
        db.commit()
        db.refresh(v)

        assert v.risk_result == "HIGH"
        assert v.blockchain_confirmed is True
        db.close()

    def test_query_by_wallet_address(self):
        db = TestSession()
        for i in range(3):
            db.add(Verification(
                id=f"v-w-{i}",
                wallet_address="0xsame",
                encrypted_payload_hash=f"h{i}",
                investment_range="Under 10K",
                protocol_name=f"Proto{i}",
            ))
        db.add(Verification(
            id="v-other",
            wallet_address="0xother",
            encrypted_payload_hash="hother",
            investment_range="Over 100K",
            protocol_name="Other",
        ))
        db.commit()

        results = db.query(Verification).filter(
            Verification.wallet_address == "0xsame"
        ).all()
        assert len(results) == 3
        db.close()

    def test_default_id_generated_when_omitted(self):
        db = TestSession()
        v = Verification(
            wallet_address="0xgen",
            encrypted_payload_hash="hgen",
            investment_range="Under 10K",
            protocol_name="Gen",
        )
        db.add(v)
        db.commit()
        db.refresh(v)

        assert v.id is not None
        assert len(v.id) == 36  # UUID format
        db.close()


# ---------------------------------------------------------------------------
# FHESession model
# ---------------------------------------------------------------------------

class TestFHESessionModel:
    def test_create_fhe_session(self):
        db = TestSession()
        expires = datetime.utcnow() + timedelta(hours=1)
        s = FHESession(
            id="s-1",
            public_key_ref="pk-ref-123",
            session_expires_at=expires,
        )
        db.add(s)
        db.commit()
        db.refresh(s)

        assert s.id == "s-1"
        assert s.public_key_ref == "pk-ref-123"
        assert isinstance(s.created_at, datetime)
        db.close()

    def test_fhe_session_nullable_public_key(self):
        db = TestSession()
        s = FHESession(
            id="s-2",
            session_expires_at=datetime.utcnow() + timedelta(hours=2),
        )
        db.add(s)
        db.commit()
        db.refresh(s)

        assert s.public_key_ref is None
        db.close()


# ---------------------------------------------------------------------------
# get_db dependency generator
# ---------------------------------------------------------------------------

class TestGetDb:
    def test_get_db_yields_and_closes(self):
        gen = get_db()
        db = next(gen)
        assert db is not None
        try:
            next(gen)
        except StopIteration:
            pass  # expected: generator exhausted after close
