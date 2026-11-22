from typing import List, Dict, Any
import httpx
from ..models.schemas import EndpointItem

DOCS_PATHS = [
    "/swagger.json", "/openapi.json", "/api-docs", "/v2/api-docs", "/docs", "/swagger/v1/swagger.json"
]

async def check_improper_inventory(
    client: httpx.AsyncClient,
    base_url: str,
    endpoints: List[EndpointItem]
) -> List[Dict[str, Any]]:
    findings = []
    clean_base = base_url.rstrip("/")

    for doc_path in DOCS_PATHS:
        target_url = f"{clean_base}/{doc_path.lstrip('/')}"
        try:
            resp = await client.get(target_url, timeout=3.0)
            if resp.status_code == 200 and ("swagger" in resp.text.lower() or "openapi" in resp.text.lower()):
                findings.append({
                    "title": f"Unauthenticated API Specification Exposure ({doc_path})",
                    "owasp_category": "API9:2023 - Improper Inventory Management",
                    "severity": "low",
                    "endpoint": doc_path,
                    "method": "GET",
                    "evidence": {
                        "requestUrl": target_url,
                        "responseStatus": resp.status_code,
                        "responseSnippet": resp.text[:200]
                    },
                    "explanation": f"The API specification document '{doc_path}' is publicly accessible without authentication in production.",
                    "potential_impact": "Reveals internal endpoints, data models, and parameter formats to unauthorized external parties.",
                    "remediation": "Restrict API documentation to internal networks or require authentication before viewing OpenAPI schemas.",
                    "confidence": "confirmed"
                })
                break
        except Exception:
            pass

    return findings
