import time
import httpx
from typing import List, Dict, Any
from .models.schemas import ScanRequest, ScanResponse, FindingSchema
from .checks.headers_cors import check_headers_and_cors
from .checks.broken_auth import check_broken_authentication
from .checks.bola import check_bola
from .checks.sensitive_data import check_sensitive_data_exposure
from .checks.resource_consumption import check_resource_consumption
from .checks.bfla import check_bfla
from .checks.inventory import check_improper_inventory

class SecurityScanner:
    async def run_scan(self, req: ScanRequest) -> ScanResponse:
        start_time = time.time()
        findings: List[Dict[str, Any]] = []

        async with httpx.AsyncClient(verify=False, follow_redirects=True) as client:
            # 1. Headers & CORS Misconfiguration
            findings.extend(await check_headers_and_cors(client, req.base_url))

            # 2. Improper Inventory & Documentation Exposure
            findings.extend(await check_improper_inventory(client, req.base_url, req.endpoints))

            # If full OWASP scan requested
            if req.scan_type in ["full_owasp", "simulation_lab"]:
                # 3. Broken Authentication
                findings.extend(await check_broken_authentication(client, req.base_url, req.endpoints, req.auth))

                # 4. Broken Object Level Authorization (BOLA)
                findings.extend(await check_bola(client, req.base_url, req.endpoints, req.auth, req.is_lab))

                # 5. Sensitive Data Exposure & Excessive Properties
                findings.extend(await check_sensitive_data_exposure(client, req.base_url, req.endpoints, req.auth))

                # 6. Unrestricted Resource Consumption & Rate Limiting
                findings.extend(await check_resource_consumption(client, req.base_url, req.endpoints, req.auth))

                # 7. Broken Function Level Authorization (BFLA)
                findings.extend(await check_bfla(client, req.base_url, req.endpoints, req.auth, req.is_lab))

        duration_ms = int((time.time() - start_time) * 1000)

        # Map to FindingSchema
        structured_findings: List[FindingSchema] = []
        for f in findings:
            structured_findings.append(FindingSchema(
                title=f["title"],
                owasp_category=f["owasp_category"],
                severity=f["severity"],
                endpoint=f["endpoint"],
                method=f["method"],
                evidence=f.get("evidence", {}),
                explanation=f["explanation"],
                potential_impact=f["potential_impact"],
                remediation=f["remediation"],
                confidence=f.get("confidence", "probable")
            ))

        return ScanResponse(
            scan_id=req.scan_id,
            status="completed",
            duration_ms=duration_ms,
            endpoints_tested=len(req.endpoints),
            findings_count=len(structured_findings),
            findings=structured_findings
        )

scanner_instance = SecurityScanner()
