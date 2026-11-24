# API Sentinel — Executive Reporting & Regulatory Compliance Reference

This specification outlines the security reporting architecture, severity rating methodology, and regulatory compliance mapping implemented within API Sentinel.

---

## 1. Executive Security Report Architecture

API Sentinel delivers dual-format reporting designed to bridge the technical-executive gap:

1. **Executive PDF Reports (`/api/v1/reports/pdf`)**: Compiled using `jspdf` and `jspdf-autotable`, rendering clean corporate styling, target metadata summaries, severity breakdowns, and remediation roadmaps.
2. **Machine-Readable JSON Reports (`/api/v1/reports/json`)**: Structured JSON schemas optimized for direct ingestion into Security Information and Event Management (SIEM) systems like Splunk, Microsoft Sentinel, and Datadog.

---

## 2. Regulatory Compliance Mapping

API Sentinel's automated OWASP API Top 10 auditing maps directly to industry-standard cybersecurity compliance controls:

| Compliance Standard | Required Control | API Sentinel Capability |
| :--- | :--- | :--- |
| **SOC 2 (Type II)** | CC6.1 - Logical Access Controls & Perimeter Defense | Automated BOLA/BFLA detection preventing unauthorized lateral movement across tenant data. |
| **HIPAA Security Rule** | § 164.312(a)(1) - Access Control & § 164.312(e)(1) - Transmission Security | Detection of excessive medical data exposure, unmasked SSNs/MRNs, and missing HSTS/TLS enforcement. |
| **PCI-DSS (v4.0)** | Requirement 6.5.8 - API Security & Requirement 10 - Automated Audit Logging | Probing for unauthenticated payment endpoints, weak CORS credential reflection, and persistent scan telemetry. |
| **GDPR (Article 32)** | Security of Processing & Personal Data Protection | Identification of leaked PII properties (`password_hash`, `ssn`, `salt`) in API response payloads. |
| **ISO/IEC 27001** | Annex A.14 - System Acquisition, Development and Maintenance | Shift-left API security testing prior to production release, integrated into CI/CD pipelines. |

---

## 3. Severity Scoring Methodology

Detected vulnerabilities are categorized into 5 standardized risk tiers:

```
+--------------------+---------------------------------------------------------------+---------------------+
| Severity           | Criteria & Technical Characteristics                         | SLA Remediation     |
+--------------------+---------------------------------------------------------------+---------------------+
| CRITICAL           | Direct unauthorized object access (BOLA), unauthenticated      | Immediate (< 24h)   |
|                    | administrative execution (BFLA), or total authentication bypass|                     |
+--------------------+---------------------------------------------------------------+---------------------+
| HIGH               | Excessive PII/password exposure, permissive CORS reflection   | Priority (< 7 days) |
|                    | with credentials, or unrestricted resource consumption        |                     |
+--------------------+---------------------------------------------------------------+---------------------+
| MEDIUM             | Missing Content-Security-Policy, weak token expirations, or    | Standard (< 30 days)|
|                    | absence of rate-limiting headers                              |                     |
+--------------------+---------------------------------------------------------------+---------------------+
| LOW                | Server banner software fingerprinting (Server, X-Powered-By)   | Backlog / Routine   |
+--------------------+---------------------------------------------------------------+---------------------+
| INFORMATIONAL      | Discovered unauthenticated OpenAPI/Swagger documentation paths | Informational       |
+--------------------+---------------------------------------------------------------+---------------------+
```

---

## 4. SIEM / JSON Ingestion Schema

The JSON export payload conforms to the following schema:

```json
{
  "exportDate": "2026-11-24T16:00:00.000Z",
  "generatedBy": "security_operator",
  "scanSummary": {
    "scanId": "scan_6790a12",
    "targetBaseUrl": "https://api.enterprise.internal",
    "endpointsTested": 14,
    "durationMs": 3410,
    "severityCounts": {
      "critical": 1,
      "high": 2,
      "medium": 3,
      "low": 1,
      "informational": 0
    }
  },
  "totalFindings": 7,
  "findings": [
    {
      "title": "Broken Object Level Authorization (BOLA)",
      "owaspCategory": "API1:2023 - Broken Object Level Authorization",
      "severity": "critical",
      "endpoint": "/api/v1/customers/:id",
      "method": "GET",
      "confidence": "confirmed",
      "remediation": "Validate session user context against resource ownership before querying the database."
    }
  ]
}
```

---

*Author: Anjan Krishna ([@Anjankrishna260106](https://github.com/Anjankrishna260106))*  
*API Sentinel Telemetry, Monitoring & Compliance Architecture*
