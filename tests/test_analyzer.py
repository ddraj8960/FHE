"""Unit tests for backend/analyzer.py — contract analysis and LLM audit logic."""

import json
from unittest.mock import patch, MagicMock

import pytest

from backend.analyzer import (
    CACHED_PROTOCOLS,
    analyze_contract_address,
    run_llm_code_audit,
)


# ---------------------------------------------------------------------------
# Tests for CACHED_PROTOCOLS registry
# ---------------------------------------------------------------------------

class TestCachedProtocols:
    """Verify the static cached-protocol registry is well-formed."""

    EXPECTED_KEYS = {
        "name", "type", "verified", "upgradeable", "proxy_pattern",
        "owner_type", "selfdestruct", "reentrancy_risk", "admin_privileges",
        "oracle_dependency", "vulnerabilities", "contract_code_risk",
        "protocol_risk_score", "contract_verification", "protocol_maturity",
    }

    def test_all_addresses_are_lowercase(self):
        for addr in CACHED_PROTOCOLS:
            assert addr == addr.lower(), f"Address {addr} should be lowercase"

    def test_all_entries_have_required_keys(self):
        for addr, data in CACHED_PROTOCOLS.items():
            missing = self.EXPECTED_KEYS - set(data.keys())
            assert not missing, f"Address {addr} is missing keys: {missing}"

    def test_risk_scores_in_valid_range(self):
        score_keys = [
            "reentrancy_risk", "admin_privileges", "contract_code_risk",
            "protocol_risk_score", "contract_verification", "protocol_maturity",
        ]
        for addr, data in CACHED_PROTOCOLS.items():
            for key in score_keys:
                val = data[key]
                assert 0.0 <= val <= 1.0, (
                    f"{addr}.{key} = {val} is out of [0, 1] range"
                )

    def test_aave_is_low_risk(self):
        aave = CACHED_PROTOCOLS["0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2"]
        assert aave["name"] == "Aave V3 Pool"
        assert aave["contract_code_risk"] <= 0.20

    def test_euler_is_higher_risk(self):
        euler = CACHED_PROTOCOLS["0x0c9a3dd6b8f28529d72d7f9ce918d493519ee383"]
        assert euler["contract_code_risk"] >= 0.50


# ---------------------------------------------------------------------------
# Tests for analyze_contract_address — cached-path
# ---------------------------------------------------------------------------

class TestAnalyzeContractCachedPath:
    """Exercise the cached-registry fast path (no network calls)."""

    def test_cached_aave_returns_registry_data(self):
        result = analyze_contract_address(
            "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"
        )
        assert result["name"] == "Aave V3 Pool"
        assert result["verified"] is True

    def test_cached_gmx_returns_registry_data(self):
        result = analyze_contract_address(
            "0xFD70de6b91282D8017aA4E741e9Ae325CAB992d8"
        )
        assert result["name"] == "GMX V2 DataStore"

    def test_cached_euler_returns_registry_data(self):
        result = analyze_contract_address(
            "0x0C9a3dd6b8F28529d72d7f9CE918D493519EE383"
        )
        assert result["name"] == "Euler Finance V2 EVC"

    def test_address_normalisation_strips_whitespace(self):
        result = analyze_contract_address(
            "  0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2  "
        )
        assert result["name"] == "Aave V3 Pool"


# ---------------------------------------------------------------------------
# Tests for analyze_contract_address — dynamic (uncached) path
# ---------------------------------------------------------------------------

class TestAnalyzeContractDynamicPath:
    """Cover the Etherscan-query + LLM-audit branch using mocks."""

    UNKNOWN_ADDRESS = "0x0000000000000000000000000000000000000001"

    @patch("backend.analyzer.requests.get")
    def test_unverified_contract_returns_high_risk_defaults(self, mock_get):
        """When Etherscan returns an empty source, treat the contract as unverified."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "status": "1",
            "result": [{"SourceCode": "", "ContractName": "MysteryContract"}],
        }
        mock_get.return_value = mock_resp

        result = analyze_contract_address(self.UNKNOWN_ADDRESS)

        assert result["verified"] is False
        assert result["type"] == "Unverified Contract"
        assert result["contract_code_risk"] >= 0.90

    @patch("backend.analyzer.requests.get")
    def test_etherscan_api_failure_returns_high_risk(self, mock_get):
        """Network errors should fail-safe to high risk."""
        mock_get.side_effect = Exception("connection timeout")

        result = analyze_contract_address(self.UNKNOWN_ADDRESS)

        assert result["verified"] is False
        assert result["contract_code_risk"] >= 0.90

    @patch("backend.analyzer.run_llm_code_audit")
    @patch("backend.analyzer.requests.get")
    def test_verified_contract_delegates_to_llm_audit(self, mock_get, mock_audit):
        """If Etherscan returns Solidity source, pass it to run_llm_code_audit."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "status": "1",
            "result": [
                {"SourceCode": "pragma solidity ^0.8.0;", "ContractName": "TestToken"}
            ],
        }
        mock_get.return_value = mock_resp

        mock_audit.return_value = {"name": "TestToken", "contract_code_risk": 0.25}

        result = analyze_contract_address(self.UNKNOWN_ADDRESS)

        mock_audit.assert_called_once()
        assert result["contract_code_risk"] == 0.25

    @patch("backend.analyzer.requests.get")
    def test_etherscan_status_not_one_returns_high_risk(self, mock_get):
        """Etherscan may return status='0' for invalid addresses."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"status": "0", "result": []}
        mock_get.return_value = mock_resp

        result = analyze_contract_address(self.UNKNOWN_ADDRESS)

        assert result["verified"] is False
        assert result["contract_code_risk"] >= 0.90


# ---------------------------------------------------------------------------
# Tests for run_llm_code_audit
# ---------------------------------------------------------------------------

class TestRunLlmCodeAudit:
    """Cover the OpenRouter LLM audit and its fallback heuristic."""

    SAMPLE_SOURCE = "pragma solidity ^0.8.0; contract Foo { }"

    @patch("backend.analyzer.requests.post")
    def test_successful_llm_response_parsed(self, mock_post):
        llm_json = {
            "name": "Foo",
            "type": "DeFi Smart Contract",
            "verified": True,
            "upgradeable": False,
            "proxy_pattern": "None",
            "owner_type": "DAO Governance",
            "selfdestruct": False,
            "reentrancy_risk": 0.10,
            "admin_privileges": 0.20,
            "oracle_dependency": False,
            "vulnerabilities": "None found.",
            "contract_code_risk": 0.15,
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": json.dumps(llm_json)}}]
        }
        mock_post.return_value = mock_resp

        result = run_llm_code_audit("Foo", self.SAMPLE_SOURCE)

        assert result["contract_code_risk"] == 0.15
        assert result["protocol_risk_score"] == 0.10  # enriched from reentrancy_risk
        assert result["contract_verification"] == 0.1  # not upgradeable → 0.1

    @patch("backend.analyzer.requests.post")
    def test_llm_response_with_markdown_fences(self, mock_post):
        """OpenRouter sometimes wraps JSON in ```json … ``` fences."""
        llm_json = {
            "name": "Bar",
            "type": "DeFi Smart Contract",
            "verified": True,
            "upgradeable": True,
            "proxy_pattern": "EIP-1967",
            "owner_type": "Multi-Sig",
            "selfdestruct": False,
            "reentrancy_risk": 0.30,
            "admin_privileges": 0.40,
            "oracle_dependency": True,
            "vulnerabilities": "Admin can pause.",
            "contract_code_risk": 0.35,
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [
                {"message": {"content": f"```json\n{json.dumps(llm_json)}\n```"}}
            ]
        }
        mock_post.return_value = mock_resp

        result = run_llm_code_audit("Bar", self.SAMPLE_SOURCE)

        assert result["contract_code_risk"] == 0.35
        assert result["contract_verification"] == 0.5  # upgradeable → 0.5

    @patch("backend.analyzer.requests.post")
    def test_llm_network_failure_triggers_fallback(self, mock_post):
        """When the LLM call fails, the keyword-based heuristic runs instead."""
        mock_post.side_effect = Exception("OpenRouter down")

        result = run_llm_code_audit("Baz", self.SAMPLE_SOURCE)

        assert result["type"] == "Audited Smart Contract (Fallback)"
        assert result["verified"] is True
        assert 0.0 <= result["contract_code_risk"] <= 0.90

    @patch("backend.analyzer.requests.post")
    def test_fallback_heuristic_detects_proxy_keyword(self, mock_post):
        mock_post.side_effect = Exception("timeout")
        source = "contract MyProxy { address implementation; }"

        result = run_llm_code_audit("MyProxy", source)

        assert result["upgradeable"] is True
        assert result["contract_code_risk"] >= 0.40  # base 0.20 + proxy 0.20

    @patch("backend.analyzer.requests.post")
    def test_fallback_heuristic_detects_selfdestruct(self, mock_post):
        mock_post.side_effect = Exception("timeout")
        source = "contract Risky { function kill() { selfdestruct(msg.sender); } }"

        result = run_llm_code_audit("Risky", source)

        assert result["selfdestruct"] is True
        assert result["contract_code_risk"] >= 0.50  # base 0.20 + selfdestruct 0.30

    @patch("backend.analyzer.requests.post")
    def test_fallback_heuristic_detects_owner(self, mock_post):
        mock_post.side_effect = Exception("timeout")
        source = "modifier onlyOwner() { require(msg.sender == owner); _; }"

        result = run_llm_code_audit("Owned", source)

        assert result["admin_privileges"] == 0.40
        assert result["contract_code_risk"] >= 0.35  # base 0.20 + owner 0.15

    @patch("backend.analyzer.requests.post")
    def test_fallback_heuristic_detects_oracle(self, mock_post):
        mock_post.side_effect = Exception("timeout")
        source = "contract OracleUser { address priceFeed; }"

        result = run_llm_code_audit("OracleUser", source)

        assert result["oracle_dependency"] is True
        assert result["contract_code_risk"] >= 0.30  # base 0.20 + oracle 0.10

    @patch("backend.analyzer.requests.post")
    def test_fallback_code_risk_capped_at_090(self, mock_post):
        """Even when every keyword fires, risk should not exceed 0.90."""
        mock_post.side_effect = Exception("timeout")
        source = (
            "contract All { address proxy; address implementation; "
            "modifier onlyOwner {} function kill() { selfdestruct(msg.sender); } "
            "address oracle; address priceFeed; }"
        )

        result = run_llm_code_audit("All", source)

        assert result["contract_code_risk"] <= 0.90

    @patch("backend.analyzer.requests.post")
    def test_llm_non_200_triggers_fallback(self, mock_post):
        """Non-200 HTTP status from OpenRouter should trigger fallback."""
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_post.return_value = mock_resp

        result = run_llm_code_audit("FailContract", self.SAMPLE_SOURCE)

        assert result["type"] == "Audited Smart Contract (Fallback)"
