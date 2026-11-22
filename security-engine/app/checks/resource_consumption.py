from typing import List, Dict, Any
import httpx
from ..models.schemas import EndpointItem, AuthPayload

RATE_LIMIT_HEADERS = [
    "x-ratelimit-limit", "x-ratelimit-remaining", "ratelimit-limit", "ratelimit", "retry-after"
]

async def check_resource_consumption(
    client: httpx.AsyncClient,
    base_url: str,
    endpoints: List[EndpointItem],
    auth: AuthPayload
) -> List[Dict[str, Any]]:
    findings = []
    clean_base = base_url.rstrip("/")

    # 1. Check for absence of Rate Limiting Headers
    try:
        resp = await client.get(clean_base, timeout=4.0)
        resp_headers = {k.lower(): v for k, v in resp.headers.items()}
        has_rate_limit = any(h in resp_headers for h in RATE_LIMIT_HEADERS)

        if not has_rate_limit:
            findings.append({
                "title": "Missing Rate Limiting Headers & Throttling Protection",
                "owasp_category": "API4:2023 - Unrestricted Resource Consumption",
                "severity": "medium",
                "endpoint": clean_base,
                "method": "GET",
                "evidence": {
                    "testedUrl": clean_base,
                    "responseHeaders": dict(resp.headers),
                    "details": "No standard rate limiting headers (X-RateLimit-* or RateLimit) detected in API responses."
                },
                "explanation": "The API does not communicate rate limits or enforce burst request throttling.",
                "potential_impact": "Vulnerability to automated brute-force, scraping, and denial-of-service (DoS) attacks.",
                "remediation": "Implement rate limiting using token bucket or sliding window algorithms (e.g., Redis or API Gateway).",
                "confidence": "probable"
            })
    except Exception:
        pass

    # 2. Check for unbounded pagination parameter
    for ep in endpoints:
        has_limit_param = any(p.get("name", "").lower() in ["limit", "size", "pagesize", "count"] for p in (ep.parameters or []))
        if has_limit_param or "orders" in ep.path.lower() or "items" in ep.path.lower():
            target_url = f"{clean_base}/{ep.path.lstrip('/')}?limit=1000000"
            try:
                resp = await client.request(ep.method, target_url, timeout=5.0)
                if resp.status_code == 200 and ("1000000" in resp.text or "totalRecordsReturned" in resp.text):
                    findings.append({
                        "title": f"Unrestricted Resource Consumption: Unbounded Pagination Limit ({ep.path})",
                        "owasp_category": "API4:2023 - Unrestricted Resource Consumption",
                        "severity": "medium",
                        "endpoint": ep.path,
                        "method": ep.method,
                        "evidence": {
                            "requestUrl": target_url,
                            "sentParameter": "limit=1000000",
                            "responseStatus": resp.status_code,
                            "responseSnippet": resp.text[:300]
                        },
                        "explanation": f"Endpoint accepted request with limit=1000000 without enforcing an upper maximum bound.",
                        "potential_impact": "High memory consumption and database CPU exhaustion leading to service degradation.",
                        "remediation": "Enforce strict maximum limits on query pagination parameters (e.g. maximum 100 items per request).",
                        "confidence": "confirmed"
                    })
            except Exception:
                pass

    return findings
