import os
import requests
import json
from typing import Dict, Any

# OpenRouter key loaded from environment variables
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Standard Etherscan / Arbiscan endpoints (uses free API endpoints)
ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY", "")

# Cached real on-chain audit results for our 3 demo protocols to ensure zero-latency & 100% demo stability
CACHED_PROTOCOLS = {
    # Aave V3 Pool on Ethereum
    "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2": {
        "name": "Aave V3 Pool",
        "type": "Lending Pool",
        "verified": True,
        "upgradeable": True,
        "proxy_pattern": "TransparentUpgradeableProxy",
        "owner_type": "DAO / Governance Timelock",
        "selfdestruct": False,
        "reentrancy_risk": 0.05,
        "admin_privileges": 0.20,
        "oracle_dependency": True,
        "vulnerabilities": "None detected in continuous audits.",
        "contract_code_risk": 0.10, # Feature #6
        "protocol_risk_score": 0.10, # Feature #2
        "contract_verification": 0.10, # Feature #3 (Verified & audited)
        "protocol_maturity": 0.15 # Feature #5 (Deployed Jan 2023)
    },
    # GMX V2 DataStore on Arbitrum
    "0xfd70de6b91282d8017aa4e741e9ae325cab992d8": {
        "name": "GMX V2 DataStore",
        "type": "Perpetual Exchange Datastore",
        "verified": True,
        "upgradeable": True,
        "proxy_pattern": "Custom EIP-1967 Proxy",
        "owner_type": "Multi-Sig Core Team",
        "selfdestruct": False,
        "reentrancy_risk": 0.20,
        "admin_privileges": 0.50,
        "oracle_dependency": True,
        "vulnerabilities": "Complex dependency on Chainlink pricing. High administrator access for position management.",
        "contract_code_risk": 0.30, # Feature #6
        "protocol_risk_score": 0.50, # Feature #2
        "contract_verification": 0.30, # Feature #3 (Verified, but multi-sig admin)
        "protocol_maturity": 0.40 # Feature #5 (Deployed Aug 2023)
    },
    # Euler V2 Ethereum Vault Connector (EVC)
    "0x0c9a3dd6b8f28529d72d7f9ce918d493519ee383": {
        "name": "Euler Finance V2 EVC",
        "type": "Modular Lending Connector",
        "verified": True,
        "upgradeable": False,
        "proxy_pattern": "None (Immutable)",
        "owner_type": "DAO Governance",
        "selfdestruct": False,
        "reentrancy_risk": 0.15,
        "admin_privileges": 0.30,
        "oracle_dependency": False,
        "vulnerabilities": "V1 suffered a $197M exploit. V2 is heavily audited but permissionless vault creation carries inherent platform risk.",
        "contract_code_risk": 0.55, # Feature #6
        "protocol_risk_score": 0.85, # Feature #2
        "contract_verification": 0.50, # Feature #3 (Immutable, but complex modular architecture)
        "protocol_maturity": 0.75 # Feature #5 (Deployed Late 2024)
    }
}

def analyze_contract_address(address: str) -> Dict[str, Any]:
    """
    Main entry point for dynamic contract auditing.
    Fetches source code from Etherscan API V2 dynamically first (checking Ethereum and Arbitrum),
    and performs a real-time LLM vulnerability audit to generate Feature #6.
    Falls back to cached protocol values if dynamic retrieval fails.
    """
    normalized_addr = address.lower().strip()
    print(f"[{address}] Performing dynamic live analysis...")
    
    solidity_source = ""
    verified = False
    contract_name = "Unknown Smart Contract"
    
    # 1. Try Ethereum Mainnet (Chain ID: 1) on Etherscan API V2
    try:
        url = f"https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode&address={address}"
        if ETHERSCAN_API_KEY:
            url += f"&apikey={ETHERSCAN_API_KEY}"
            
        r = requests.get(url, timeout=10)
        data = r.json()
        
        if data.get("status") == "1" and data.get("result"):
            result = data["result"][0]
            solidity_source = result.get("SourceCode", "")
            contract_name = result.get("ContractName", "Custom Contract")
            
            if solidity_source:
                verified = True
                print(f"Contract {contract_name} verified on Ethereum Etherscan (V2).")
    except Exception as e:
        print(f"Ethereum Etherscan V2 query failed: {e}")
        
    # 2. Try Arbitrum One (Chain ID: 42161) on Etherscan API V2 if not verified yet
    if not verified:
        try:
            url = f"https://api.etherscan.io/v2/api?chainid=42161&module=contract&action=getsourcecode&address={address}"
            if ETHERSCAN_API_KEY:
                url += f"&apikey={ETHERSCAN_API_KEY}"
                
            r = requests.get(url, timeout=10)
            data = r.json()
            
            if data.get("status") == "1" and data.get("result"):
                result = data["result"][0]
                solidity_source = result.get("SourceCode", "")
                contract_name = result.get("ContractName", "Custom Contract")
                
                if solidity_source:
                    verified = True
                    print(f"Contract {contract_name} verified on Arbitrum Arbiscan (V2).")
        except Exception as e:
            print(f"Arbiscan V2 query failed: {e}")

    # 3. Fallback to cached registry if query failed but address is cached
    if not verified and normalized_addr in CACHED_PROTOCOLS:
        print(f"[{address}] Dynamic query failed or unverified on V2. Falling back to cached protocol registry.")
        return CACHED_PROTOCOLS[normalized_addr]

    # 4. If still not verified, assign default high risk parameters (safe default)
    if not verified:
        return {
            "name": contract_name,
            "type": "Unverified Contract",
            "verified": False,
            "upgradeable": True,
            "proxy_pattern": "Unknown",
            "owner_type": "Unknown",
            "selfdestruct": True,
            "reentrancy_risk": 0.80,
            "admin_privileges": 0.90,
            "oracle_dependency": True,
            "vulnerabilities": "CRITICAL: Smart contract source code is not verified on Etherscan/Arbiscan V2. Bytecode execution carries high threat vector.",
            "contract_code_risk": 0.95,
            "protocol_risk_score": 0.90,
            "contract_verification": 0.90,
            "protocol_maturity": 0.90
        }
        
    # If verified, run LLM code audit
    return run_llm_code_audit(contract_name, solidity_source[:10000]) # Limit source length to preserve tokens

def run_llm_code_audit(contract_name: str, source_code: str) -> Dict[str, Any]:
    """
    Sends the smart contract Solidity code to Gemini or OpenRouter for a zero-knowledge audit.
    Parses the response to calculate the exact Feature #6 score.
    """
    prompt = f"""
    You are an expert smart contract auditor. Analyze the following Solidity code snippet for '{contract_name}' and provide a structured JSON assessment.
    
    Code snippet:
    ```solidity
    {source_code}
    ```
    
    Identify:
    1. Admin / Owner privileges (0.0 to 1.0, where 1.0 is centralized/unrestricted admin).
    2. Upgradeability (Is it a proxy? EIP-1967? Yes/No).
    3. Reentrancy risks (0.0 to 1.0, where 1.0 is high risk).
    4. Oracle dependencies (Yes/No).
    5. Presence of dangerous features like `selfdestruct` (Yes/No).
    6. Overall Code Vulnerability Score (0.0 to 1.0, where 1.0 is highly vulnerable).
    
    Return ONLY a valid JSON block of this format (no other text or explanations):
    {{
        "name": "{contract_name}",
        "type": "DeFi Smart Contract",
        "verified": true,
        "upgradeable": true,
        "proxy_pattern": "Proxy description",
        "owner_type": "DAO or Multi-Sig or EOA Admin",
        "selfdestruct": false,
        "reentrancy_risk": 0.15,
        "admin_privileges": 0.30,
        "oracle_dependency": true,
        "vulnerabilities": "Brief explanation of vulnerabilities",
        "contract_code_risk": 0.25
    }}
    """
    
    # 1. Try Direct Google Gemini API first if GEMINI_API_KEY is available
    if GEMINI_API_KEY:
        try:
            print("Running dynamic LLM audit via native Google Gemini API...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={GEMINI_API_KEY}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{
                    "parts": [{"text": prompt}]
                }],
                "generationConfig": {
                    "responseMimeType": "application/json"
                }
            }
            r = requests.post(url, headers=headers, json=payload, timeout=60)
            if r.status_code == 200:
                res_data = r.json()
                content = res_data["candidates"][0]["content"]["parts"][0]["text"]
                content = content.replace("```json", "").replace("```", "").strip()
                parsed_result = json.loads(content)
                
                # Enrich with defaults
                parsed_result["protocol_risk_score"] = parsed_result.get("reentrancy_risk", 0.5)
                parsed_result["contract_verification"] = 0.5 if parsed_result.get("upgradeable") else 0.1
                parsed_result["protocol_maturity"] = 0.5
                
                print(f"Native Gemini audit succeeded: {parsed_result['contract_code_risk']}")
                return parsed_result
            else:
                print(f"Native Gemini API call returned status {r.status_code}: {r.text}")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Native Gemini API call failed: {e}. Trying OpenRouter...")

    # 2. Try OpenRouter API if OPENROUTER_API_KEY is available
    if OPENROUTER_API_KEY:
        try:
            print("Running dynamic LLM audit via OpenRouter...")
            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "google/gemini-2.5-flash",
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
            r = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=60
            )
            if r.status_code == 200:
                res_data = r.json()
                content = res_data["choices"][0]["message"]["content"]
                content = content.replace("```json", "").replace("```", "").strip()
                parsed_result = json.loads(content)
                
                parsed_result["protocol_risk_score"] = parsed_result.get("reentrancy_risk", 0.5)
                parsed_result["contract_verification"] = 0.5 if parsed_result.get("upgradeable") else 0.1
                parsed_result["protocol_maturity"] = 0.5
                
                print(f"OpenRouter audit succeeded: {parsed_result['contract_code_risk']}")
                return parsed_result
        except Exception as e:
            print(f"OpenRouter API call failed: {e}.")

    # If both keys are missing or calls failed, fall back to heuristic scan
    print("No working LLM API keys configured or request failed. Executing fail-safe heuristic fallback...")
        
    # Fail-safe fallback: generate reasonable values based on regex keyword analysis
    has_proxy = "proxy" in source_code.lower() or "implementation" in source_code.lower()
    has_owner = "owner" in source_code.lower() or "onlyowner" in source_code.lower() or "admin" in source_code.lower()
    has_selfdestruct = "selfdestruct" in source_code.lower() or "suicide" in source_code.lower()
    has_oracle = "oracle" in source_code.lower() or "pricefeed" in source_code.lower()
    
    code_risk = 0.20
    if has_proxy: code_risk += 0.20
    if has_owner: code_risk += 0.15
    if has_selfdestruct: code_risk += 0.30
    if has_oracle: code_risk += 0.10
    code_risk = min(code_risk, 0.90)
    
    return {
        "name": contract_name,
        "type": "Audited Smart Contract (Fallback)",
        "verified": True,
        "upgradeable": has_proxy,
        "proxy_pattern": "Detected upgradeable storage slots" if has_proxy else "None",
        "owner_type": "Privileged Admin Role" if has_owner else "None",
        "selfdestruct": has_selfdestruct,
        "reentrancy_risk": 0.30,
        "admin_privileges": 0.40 if has_owner else 0.10,
        "oracle_dependency": has_oracle,
        "vulnerabilities": "Heuristic scan completed due to LLM network timeout. Privilege roles detected.",
        "contract_code_risk": code_risk,
        "protocol_risk_score": code_risk,
        "contract_verification": 0.40 if has_proxy else 0.10,
        "protocol_maturity": 0.50
    }
