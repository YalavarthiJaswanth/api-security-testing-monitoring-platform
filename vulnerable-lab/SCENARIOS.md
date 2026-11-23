# API Sentinel — Simulation Lab Vulnerability Scenarios

This document serves as the technical reference for the 7 deliberate OWASP API Top 10 security scenarios hosted inside the isolated `vulnerable-lab` microservice (listening locally on port `5050`).

---

## Overview of Simulated Scenarios

| # | Scenario ID | OWASP Category | Severity | Path | Method |
|---|---|---|---|---|---|
| 1 | `bola` | API1:2023 - Broken Object Level Authorization | Critical | `/api/v1/lab/users/:id` | `GET` |
| 2 | `broken_auth` | API2:2023 - Broken Authentication | High | `/api/v1/lab/auth/reset-password` | `POST` |
| 3 | `excessive_data`| API3:2023 - Broken Object Property Level Auth | High | `/api/v1/lab/accounts/profile` | `GET` |
| 4 | `permissive_cors`| API8:2023 - Security Misconfiguration | High | `/api/v1/lab/data/export` | `GET` |
| 5 | `missing_headers`| API8:2023 - Security Misconfiguration | Medium | `/api/v1/lab/public/info` | `GET` |
| 6 | `unrestricted_resource`| API4:2023 - Unrestricted Resource Consumption | High | `/api/v1/lab/orders` | `GET` |
| 7 | `bfla` | API5:2023 - Broken Function Level Authorization | Critical | `/api/v1/lab/admin/users/grant-admin`| `POST` |

---

## Detailed Vulnerability Analysis & Reproducible Proofs

### 1. Broken Object Level Authorization (BOLA / IDOR)
- **Vulnerable Endpoint:** `GET /api/v1/lab/users/:id`
- **Flaw Description:** The endpoint directly extracts the `:id` parameter from the URL path and queries data without checking if the calling subject has authorization or ownership over that resource ID.
- **Attack Vector:** An attacker swaps their own user ID for a foreign identifier such as `user_9921`.
- **Test Request:**
  ```bash
  curl -X GET http://localhost:5050/api/v1/lab/users/user_9921
  ```
- **Vulnerable Response:** Leaks victim's full name ("Dr. Jane Vance"), medical record number, billing address, and Social Security Number.
- **Secure Implementation Fix:**
  ```javascript
  app.get('/api/v1/lab/users/:id', authenticateToken, (req, res) => {
    // Enforce object-level ownership check against verified token context
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: You do not own this object.' });
    }
    const userProfile = getUserById(req.params.id);
    res.json(userProfile);
  });
  ```

---

### 2. Broken Authentication — Insecure Password Reset
- **Vulnerable Endpoint:** `POST /api/v1/lab/auth/reset-password`
- **Flaw Description:** The reset endpoint blindly accepts arbitrary, untrusted reset tokens without cryptographic signature validation or database expiration checks.
- **Attack Vector:** An adversary sends a forged reset request targeting an arbitrary account.
- **Test Request:**
  ```bash
  curl -X POST http://localhost:5050/api/v1/lab/auth/reset-password \
    -H "Content-Type: application/json" \
    -d '{"email":"victim@target.internal","newPassword":"HackedPassword123!","resetToken":"arbitrary_token"}'
  ```
- **Secure Implementation Fix:** Store time-limited reset tokens hashed with SHA-256 in the database and invalidate them immediately after a single use.

---

### 3. Broken Object Property Level Authorization (Excessive Data Exposure)
- **Vulnerable Endpoint:** `GET /api/v1/lab/accounts/profile`
- **Flaw Description:** The endpoint dumps the full database model serialization, exposing sensitive internal attributes over the network.
- **Attack Vector:** Calling the standard user profile endpoint leaks `password_hash`, `salt`, `ssn`, and `internal_api_secret`.
- **Test Request:**
  ```bash
  curl -X GET http://localhost:5050/api/v1/lab/accounts/profile
  ```
- **Secure Implementation Fix:** Apply Data Transfer Objects (DTOs) or field selection projections in database queries (`select: 'id username email'`).

---

### 4. Overly Permissive CORS with Credentials
- **Vulnerable Endpoint:** `GET /api/v1/lab/data/export`
- **Flaw Description:** The endpoint dynamically reflects the caller's `Origin` header while setting `Access-Control-Allow-Credentials: true`.
- **Attack Vector:** An attacker hosts a malicious website that issues cross-origin requests using the victim's session cookies and reads exported account transactions.
- **Secure Implementation Fix:** Maintain a strict allowlist of authorized domain origins and reject unvetted cross-origin credential sharing.

---

### 5. Missing Security Headers & Information Disclosure
- **Vulnerable Endpoint:** `GET /api/v1/lab/public/info`
- **Flaw Description:** The server omits essential defense-in-depth headers (`HSTS`, `CSP`, `X-Content-Type-Options`) and leaks backend version banners (`Server`, `X-Powered-By`).
- **Secure Implementation Fix:** Implement `helmet` middleware in Express and disable server version banners:
  ```javascript
  app.disable('x-powered-by');
  app.use(helmet());
  ```

---

### 6. Unrestricted Resource Consumption
- **Vulnerable Endpoint:** `GET /api/v1/lab/orders?limit=1000000`
- **Flaw Description:** The server accepts unbounded pagination limits without enforcing an upper ceiling.
- **Secure Implementation Fix:** Enforce a hard ceiling on request parameters: `const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);`.

---

### 7. Broken Function Level Authorization (BFLA)
- **Vulnerable Endpoint:** `POST /api/v1/lab/admin/users/grant-admin`
- **Flaw Description:** Administrative endpoint executes role elevation without verifying whether the caller possesses an administrator role.
- **Secure Implementation Fix:** Implement role-based access control middleware:
  ```javascript
  function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Administrative role required' });
    }
    next();
  }
  ```

---

*Author: Pramodh Chitta ([@chittapramodh05](https://github.com/chittapramodh05))*  
*API Sentinel Vulnerability Research & Demonstration Lab*
