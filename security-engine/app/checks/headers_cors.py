from typing import List, Dict, Any
import httpx

async def check_headers_and_cors(client: httpx.AsyncClient, base_url: str) -> List[Dict[str, Any]]:
    findings = []
    try:
        # Test base or info route
        resp = await client.get(base_url, timeout=5.0)
        headers = {k.lower(): v for k, v in resp.headers.items()}

        # 1. Check Missing Security Headers
        security_headers = [
            ("strict-transport-security", "Missing Strict-Transport-Security (HSTS) Header", "medium", 
             "The API does not enforce HTTPS connections via HSTS, permitting potential SSL stripping attacks."),
            ("x-content-type-options", "Missing X-Content-Type-Options Header", "low", 
             "The server does not prevent MIME-type sniffing, which can allow malicious scripts to be executed."),
            ("x-frame-options", "Missing X-Frame-Options Header", "low", 
             "The API does not protect against clickjacking attacks if rendered in an iframe context."),
            ("content-security-policy", "Missing Content-Security-Policy (CSP) Header", "medium", 
             "No CSP header is defined, leaving clients vulnerable to XSS and unauthorized resource loading.")
        ]

        for header_name, title, severity, explanation in security_headers:
            if header_name not in headers:
                findings.append({
                    "title": title,
                    "owasp_category": "API8:2023 - Security Misconfiguration",
                    "severity": severity,
                    "endpoint": base_url,
                    "method": "GET",
                    "evidence": {
                        "requestUrl": base_url,
                        "responseStatus": resp.status_code,
                        "responseHeaders": dict(resp.headers),
                        "details": f"Header '{header_name}' was not found in HTTP response."
                    },
                    "explanation": explanation,
                    "potential_impact": "Exposure to client-side attacks, protocol downgrading, or MIME confusion.",
                    "remediation": f"Configure the reverse proxy or API gateway to return '{header_name}' with safe defaults.",
                    "confidence": "confirmed"
                })

        # 2. Check Overly Permissive CORS
        # Send request with attacker origin
        cors_resp = await client.get(base_url, headers={"Origin": "https://attacker.evil.com"}, timeout=5.0)
        cors_headers = {k.lower(): v for k, v in cors_resp.headers.items()}
        allow_origin = cors_headers.get("access-control-allow-origin")
        allow_creds = cors_headers.get("access-control-allow-credentials")

        if allow_origin == "*" or (allow_origin == "https://attacker.evil.com" and allow_creds == "true"):
            findings.append({
                "title": "Insecure / Permissive Cross-Origin Resource Sharing (CORS)",
                "owasp_category": "API8:2023 - Security Misconfiguration",
                "severity": "high",
                "endpoint": base_url,
                "method": "GET",
                "evidence": {
                    "requestUrl": base_url,
                    "requestOrigin": "https://attacker.evil.com",
                    "accessControlAllowOrigin": allow_origin,
                    "accessControlAllowCredentials": allow_creds
                },
                "explanation": "The API either uses a wildcard '*' or blindly reflects the Origin header while permitting credentials.",
                "potential_impact": "Malicious websites can execute requests on behalf of authenticated users and read private response data.",
                "remediation": "Restrict Access-Control-Allow-Origin to an explicit allowlist of authorized origins.",
                "confidence": "confirmed"
            })

        # 3. Server Version Disclosure
        server_banner = headers.get("server") or headers.get("x-powered-by")
        if server_banner:
            findings.append({
                "title": "Server Software Fingerprint Exposure",
                "owasp_category": "API8:2023 - Security Misconfiguration",
                "severity": "low",
                "endpoint": base_url,
                "method": "GET",
                "evidence": {
                    "requestUrl": base_url,
                    "serverBanner": server_banner
                },
                "explanation": f"The API response exposes underlying software versions: '{server_banner}'.",
                "potential_impact": "Assists attackers in targeting known CVEs for the specific server version.",
                "remediation": "Disable Server and X-Powered-By response headers in web server configuration.",
                "confidence": "confirmed"
            })

    except Exception:
        pass

    return findings
