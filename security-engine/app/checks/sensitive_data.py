from typing import List, Dict, Any
import httpx
import re
from ..models.schemas import EndpointItem, AuthPayload

SENSITIVE_KEYS = [
    "password_hash", "password", "passwd", "secret_key", "internal_token",
    "private_key", "social_security", "ssn", "cvv", "credit_card", "card_number"
]

SSN_REGEX = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")

async def check_sensitive_data_exposure(
    client: httpx.AsyncClient,
    base_url: str,
    endpoints: List[EndpointItem],
    auth: AuthPayload
) -> List[Dict[str, Any]]:
    findings = []
    clean_base = base_url.rstrip("/")

    # Probe up to 5 endpoints
    test_endpoints = endpoints[:5] if endpoints else [EndpointItem(path="/", method="GET")]

    for ep in test_endpoints:
        target_url = f"{clean_base}/{ep.path.lstrip('/')}"
        headers = {}
        if auth and auth.token:
            headers["Authorization"] = f"Bearer {auth.token}"

        try:
            resp = await client.request(ep.method, target_url, headers=headers, timeout=4.0)
            if resp.status_code == 200:
                resp_text = resp.text.lower()
                detected_keys = []

                for key in SENSITIVE_KEYS:
                    if f'"{key}"' in resp_text:
                        detected_keys.append(key)

                has_ssn_pattern = bool(SSN_REGEX.search(resp.text))

                if detected_keys or has_ssn_pattern:
                    findings.append({
                        "title": f"Excessive Data Exposure / Sensitive Property Leak ({ep.path})",
                        "owasp_category": "API3:2023 - Broken Object Property Level Authorization",
                        "severity": "high",
                        "endpoint": ep.path,
                        "method": ep.method,
                        "evidence": {
                            "requestUrl": target_url,
                            "detectedSensitiveProperties": detected_keys,
                            "piiPatternDetected": "SSN Pattern Match" if has_ssn_pattern else None,
                            "responseStatus": resp.status_code,
                            "responseSnippet": resp.text[:300]
                        },
                        "explanation": f"Endpoint exposes internal sensitive fields ({', '.join(detected_keys) if detected_keys else 'PII data'}) directly in the response payload.",
                        "potential_impact": "Leakage of passwords, encryption keys, PII, and sensitive business properties.",
                        "remediation": "Apply Data Transfer Objects (DTOs) or field projection filters to serialize only explicitly required fields.",
                        "confidence": "confirmed"
                    })
        except Exception:
            pass

    return findings
