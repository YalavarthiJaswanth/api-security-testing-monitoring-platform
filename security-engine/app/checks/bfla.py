from typing import List, Dict, Any
import httpx
from ..models.schemas import EndpointItem, AuthPayload

ADMIN_PATHS = [
    "/admin", "/api/admin", "/manage", "/api/v1/admin/users",
    "/api/v1/lab/admin/users/grant-admin", "/internal/metrics"
]

async def check_bfla(
    client: httpx.AsyncClient,
    base_url: str,
    endpoints: List[EndpointItem],
    auth: AuthPayload,
    is_lab: bool = False
) -> List[Dict[str, Any]]:
    findings = []
    clean_base = base_url.rstrip("/")

    # Check known administrative paths
    paths_to_check = [ep.path for ep in endpoints if "admin" in ep.path.lower()]
    if not paths_to_check:
        paths_to_check = ADMIN_PATHS[:3]

    for path in paths_to_check:
        target_url = f"{clean_base}/{path.lstrip('/')}"
        headers = {}
        if auth and auth.token:
            headers["Authorization"] = f"Bearer {auth.token}"

        try:
            # Send standard user request or unauthenticated probe
            resp = await client.post(
                target_url,
                json={"targetUserId": "test_user", "role": "superadmin"},
                headers=headers,
                timeout=4.0
            )

            if resp.status_code in [200, 201] and ("success" in resp.text.lower() or "admin" in resp.text.lower()):
                findings.append({
                    "title": f"Broken Function Level Authorization (BFLA): Administrative Action Accessible ({path})",
                    "owasp_category": "API5:2023 - Broken Function Level Authorization",
                    "severity": "critical",
                    "endpoint": path,
                    "method": "POST",
                    "evidence": {
                        "requestUrl": target_url,
                        "requestHeaders": headers,
                        "responseStatus": resp.status_code,
                        "responseSnippet": resp.text[:300]
                    },
                    "explanation": f"Endpoint '{path}' allowed execution of administrative operations without validating administrator roles.",
                    "potential_impact": "Full privilege escalation to superadmin and complete platform compromise.",
                    "remediation": "Enforce strict role-based access control (RBAC) middleware verifying administrator privileges on all admin routes.",
                    "confidence": "confirmed" if is_lab else "probable"
                })
        except Exception:
            pass

    return findings
