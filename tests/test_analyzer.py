"""Unit tests for backend/analyzer.py — contract analysis and LLM audit logic.

The upstream analyzer uses a dynamic-first flow:
  1. Try Etherscan V2 (Ethereum chain 1)
  2. Try Etherscan V2 (Arbitrum chain 42161)
  3. Fall back to CACHED_PROTOCOLS if address is cached but unverified
  4. Return high-risk default if completely unknown

run_llm_code_audit tries:
  1. Native Gemini API (if GEMINI_API_KEY set)
  2. OpenRouter API  (if OPENROUTER_API_KEY set)
  3. Raises RuntimeError if both fail/missing
"""

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
# Tests for analyze_contract_address — cache fallback path
# (Dynamic queries fail → falls back to CACHED_PROTOCOLS)
# ---------------------------------------------------------------------------

class TestAnalyzeContractCacheFallback:
    """When Etherscan V2 dynamic queries fail, cached addresses fall back to registry."""

    @patch("backend.analyzer.requests.get")
    def test_cached_aave_returns_via_fallback(self, mock_get):
        """Etherscan fails → cache hit for Aave."""
        mock_get.side_effect = Exception("network error")
        result = analyze_contract_address(
            "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"
        )
        assert result["name"] == "Aave V3 Pool"
        assert result["verified"] is True

    @patch("backend.analyzer.requests.get")
    def test_cached_gmx_returns_via_fallback(self, mock_get):
        mock_get.side_effect = Exception("network error")
        result = analyze_contract_address(
            "0xFD70de6b91282D8017aA4E741e9Ae325CAB992d8"
        )
        assert result["name"] == "GMX V2 DataStore"

    @patch("backend.analyzer.requests.get")
    def test_cached_euler_returns_via_fallback(self, mock_get):
        mock_get.side_effect = Exception("network error")
        result = analyze_contract_address(
            "0x0C9a3dd6b8F28529d72d7f9CE918D493519EE383"
        )
        assert result["name"] == "Euler Finance V2 EVC"

    @patch("backend.analyzer.requests.get")
    def test_address_normalisation_strips_whitespace(self, mock_get):
        mock_get.side_effect = Exception("network error")
        result = analyze_contract_address(
            "  0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2  "
        )
        assert result["name"] == "Aave V3 Pool"

    @patch("backend.analyzer.requests.get")
    def test_unverified_etherscan_falls_back_to_cache(self, mock_get):
        """Etherscan returns empty source but address is cached → use cache."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "status": "1",
            "result": [{"SourceCode": "", "ContractName": "SomeContract"}],
        }
        mock_get.return_value = mock_resp
        result = analyze_contract_address(
            "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2"
        )
        assert result["name"] == "Aave V3 Pool"


# ---------------------------------------------------------------------------
# Tests for analyze_contract_address — dynamic (uncached) path
# ---------------------------------------------------------------------------

class TestAnalyzeContractDynamicPath:
    """Cover the Etherscan V2 query paths using mocks."""

    UNKNOWN_ADDRESS = "0x0000000000000000000000000000000000000001"

    @patch("backend.analyzer.requests.get")
    def test_unverified_unknown_contract_returns_high_risk(self, mock_get):
        """When Etherscan returns empty source and address is NOT cached → high risk default."""
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
    def test_etherscan_api_failure_unknown_address_returns_high_risk(self, mock_get):
        """Network errors on unknown address → high risk default."""
        mock_get.side_effect = Exception("connection timeout")

        result = analyze_contract_address(self.UNKNOWN_ADDRESS)

        assert result["verified"] is False
        assert result["contract_code_risk"] >= 0.90

    @patch("backend.analyzer.run_llm_code_audit")
    @patch("backend.analyzer.requests.get")
    def test_verified_contract_on_ethereum_delegates_to_llm_audit(self, mock_get, mock_audit):
        """If Etherscan V2 Ethereum returns Solidity source, pass it to run_llm_code_audit."""
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

    @patch("backend.analyzer.run_llm_code_audit")
    @patch("backend.analyzer.requests.get")
    def test_verified_on_arbitrum_fallback(self, mock_get, mock_audit):
        """If Ethereum returns empty but Arbitrum returns source → LLM audit runs."""
        def side_effect(url, timeout=10):
            resp = MagicMock()
            if "chainid=1" in url:
                resp.json.return_value = {
                    "status": "1",
                    "result": [{"SourceCode": "", "ContractName": ""}],
                }
            else:
                resp.json.return_value = {
                    "status": "1",
                    "result": [
                        {"SourceCode": "pragma solidity ^0.8.0;", "ContractName": "ArbToken"}
                    ],
                }
            return resp

        mock_get.side_effect = side_effect
        mock_audit.return_value = {"name": "ArbToken", "contract_code_risk": 0.30}

        result = analyze_contract_address(self.UNKNOWN_ADDRESS)

        mock_audit.assert_called_once()
        assert result["contract_code_risk"] == 0.30

    @patch("backend.analyzer.requests.get")
    def test_etherscan_status_not_one_returns_high_risk(self, mock_get):
        """Etherscan may return status='0' for invalid addresses."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"status": "0", "result": []}
        mock_get.return_value = mock_resp

        result = analyze_contract_address(self.UNKNOWN_ADDRESS)

        assert result["verified"] is False
        assert result["contract_code_risk"] >= 0.90

    @patch("backend.analyzer.requests.get")
    def test_both_chains_queried_when_ethereum_empty(self, mock_get):
        """Both Ethereum and Arbitrum endpoints are tried."""
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "status": "1",
            "result": [{"SourceCode": "", "ContractName": ""}],
        }
        mock_get.return_value = mock_resp

        analyze_contract_address(self.UNKNOWN_ADDRESS)

        assert mock_get.call_count == 2
        calls = [str(c) for c in mock_get.call_args_list]
        assert any("chainid=1" in c for c in calls)
        assert any("chainid=42161" in c for c in calls)


# ---------------------------------------------------------------------------
# Tests for run_llm_code_audit — Gemini path
# ---------------------------------------------------------------------------

class TestRunLlmCodeAuditGemini:
    """Cover the native Gemini API path."""

    SAMPLE_SOURCE = "pragma solidity ^0.8.0; contract Foo { }"

    @patch.dict("os.environ", {"GEMINI_API_KEY": "test-gemini-key"}, clear=False)
    @patch("backend.analyzer.GEMINI_API_KEY", "test-gemini-key")
    @patch("backend.analyzer.requests.post")
    def test_successful_gemini_response_parsed(self, mock_post):
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
            "candidates": [{"content": {"parts": [{"text": json.dumps(llm_json)}]}}]
        }
        mock_post.return_value = mock_resp

        result = run_llm_code_audit("Foo", self.SAMPLE_SOURCE)

        assert result["contract_code_risk"] == 0.15
        assert result["protocol_risk_score"] == 0.10  # enriched from reentrancy_risk
        assert result["contract_verification"] == 0.1  # not upgradeable → 0.1

    @patch.dict("os.environ", {"GEMINI_API_KEY": "test-gemini-key"}, clear=False)
    @patch("backend.analyzer.GEMINI_API_KEY", "test-gemini-key")
    @patch("backend.analyzer.requests.post")
    def test_gemini_upgradeable_sets_contract_verification_half(self, mock_post):
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
            "candidates": [{"content": {"parts": [{"text": json.dumps(llm_json)}]}}]
        }
        mock_post.return_value = mock_resp

        result = run_llm_code_audit("Bar", self.SAMPLE_SOURCE)

        assert result["contract_code_risk"] == 0.35
        assert result["contract_verification"] == 0.5  # upgradeable → 0.5


# ---------------------------------------------------------------------------
# Tests for run_llm_code_audit — OpenRouter path
# ---------------------------------------------------------------------------

class TestRunLlmCodeAuditOpenRouter:
    """Cover the OpenRouter fallback path (no Gemini key)."""

    SAMPLE_SOURCE = "pragma solidity ^0.8.0; contract Foo { }"

    @patch("backend.analyzer.GEMINI_API_KEY", "")
    @patch("backend.analyzer.OPENROUTER_API_KEY", "test-openrouter-key")
    @patch("backend.analyzer.requests.post")
    def test_openrouter_response_parsed(self, mock_post):
        llm_json = {
            "name": "Foo",
            "type": "DeFi Smart Contract",
            "verified": True,
            "upgradeable": False,
            "proxy_pattern": "None",
            "owner_type": "DAO",
            "selfdestruct": False,
            "reentrancy_risk": 0.12,
            "admin_privileges": 0.15,
            "oracle_dependency": False,
            "vulnerabilities": "Minimal risk.",
            "contract_code_risk": 0.18,
        }
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": json.dumps(llm_json)}}]
        }
        mock_post.return_value = mock_resp

        result = run_llm_code_audit("Foo", self.SAMPLE_SOURCE)

        assert result["contract_code_risk"] == 0.18
        assert result["protocol_risk_score"] == 0.12

    @patch("backend.analyzer.GEMINI_API_KEY", "")
    @patch("backend.analyzer.OPENROUTER_API_KEY", "test-openrouter-key")
    @patch("backend.analyzer.requests.post")
    def test_openrouter_with_markdown_fences(self, mock_post):
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


# ---------------------------------------------------------------------------
# Tests for run_llm_code_audit — error paths
# ---------------------------------------------------------------------------

class TestRunLlmCodeAuditErrors:
    """Cover failure/missing-key scenarios."""

    SAMPLE_SOURCE = "pragma solidity ^0.8.0; contract Foo { }"

    @patch("backend.analyzer.GEMINI_API_KEY", "")
    @patch("backend.analyzer.OPENROUTER_API_KEY", "")
    def test_no_api_keys_raises_runtime_error(self):
        """When both API keys are missing, RuntimeError is raised."""
        with pytest.raises(RuntimeError, match="No working LLM API keys"):
            run_llm_code_audit("NoKeys", self.SAMPLE_SOURCE)

    @patch("backend.analyzer.GEMINI_API_KEY", "key")
    @patch("backend.analyzer.OPENROUTER_API_KEY", "")
    @patch("backend.analyzer.requests.post")
    def test_gemini_failure_with_no_openrouter_raises(self, mock_post):
        """Gemini fails and no OpenRouter key → RuntimeError."""
        mock_post.side_effect = Exception("Gemini down")
        with pytest.raises(RuntimeError, match="No working LLM API keys"):
            run_llm_code_audit("Fail", self.SAMPLE_SOURCE)

    @patch("backend.analyzer.GEMINI_API_KEY", "key")
    @patch("backend.analyzer.OPENROUTER_API_KEY", "key2")
    @patch("backend.analyzer.requests.post")
    def test_both_apis_fail_raises(self, mock_post):
        """Both Gemini and OpenRouter fail → RuntimeError."""
        mock_post.side_effect = Exception("all APIs down")
        with pytest.raises(RuntimeError, match="No working LLM API keys"):
            run_llm_code_audit("AllFail", self.SAMPLE_SOURCE)

    @patch("backend.analyzer.GEMINI_API_KEY", "key")
    @patch("backend.analyzer.OPENROUTER_API_KEY", "")
    @patch("backend.analyzer.requests.post")
    def test_gemini_non_200_with_no_openrouter_raises(self, mock_post):
        """Non-200 from Gemini and no OpenRouter key → RuntimeError."""
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"
        mock_post.return_value = mock_resp
        with pytest.raises(RuntimeError, match="No working LLM API keys"):
            run_llm_code_audit("Non200", self.SAMPLE_SOURCE)

    @patch("backend.analyzer.GEMINI_API_KEY", "gemini-key")
    @patch("backend.analyzer.OPENROUTER_API_KEY", "openrouter-key")
    @patch("backend.analyzer.requests.post")
    def test_gemini_fails_then_openrouter_succeeds(self, mock_post):
        """Gemini returns non-200, OpenRouter succeeds → use OpenRouter result."""
        llm_json = {
            "name": "Recovered",
            "type": "DeFi Smart Contract",
            "verified": True,
            "upgradeable": False,
            "proxy_pattern": "None",
            "owner_type": "DAO",
            "selfdestruct": False,
            "reentrancy_risk": 0.20,
            "admin_privileges": 0.10,
            "oracle_dependency": False,
            "vulnerabilities": "None.",
            "contract_code_risk": 0.22,
        }

        def side_effect(url, **kwargs):
            resp = MagicMock()
            if "generativelanguage.googleapis.com" in url:
                resp.status_code = 500
                resp.text = "error"
            else:
                resp.status_code = 200
                resp.json.return_value = {
                    "choices": [{"message": {"content": json.dumps(llm_json)}}]
                }
            return resp

        mock_post.side_effect = side_effect

        result = run_llm_code_audit("Recovered", self.SAMPLE_SOURCE)

        assert result["contract_code_risk"] == 0.22
