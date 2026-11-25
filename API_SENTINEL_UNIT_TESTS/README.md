# API Sentinel — Standalone Unit Testing Package

This directory is an **independent, zero-modification unit testing suite** for the **API Security Testing & Monitoring Platform (API Sentinel)**.

It inspects and imports modules from the original project at:
`/Users/michael/.gemini/antigravity/scratch/api-security-testing-monitoring-platform`
in **read-only mode**, without modifying any application source code, `package.json`, `requirements.txt`, Dockerfiles, Jenkinsfiles, Kubernetes manifests, or Git history.

---

## 📁 Folder Structure

```text
API_SENTINEL_UNIT_TESTS/
├── README.md                                 # Setup, VS Code guide & test scope documentation
├── pytest.ini                                # Isolated pytest configuration pointing read-only to security-engine
├── requirements.txt                          # Optional isolated Python dependencies
├── run_tests.py                              # Master cross-suite Python launcher & report generator
├── run_tests.sh                              # macOS executable shell launcher
├── helpers/
│   ├── project_loader.cjs                    # Safe read-only loader for backend/dist & frontend/src
│   └── mock_http.cjs                         # Mock Express req/res & ephemeral localhost test server
├── authentication_tests/
│   └── auth.test.cjs                         # Register, login, bcrypt hashing, JWT lifecycle & RBAC middleware
├── backend_tests/
│   ├── api_management.test.cjs               # API CRUD, cascade delete, OpenAPI JSON/YAML parser, duplicates
│   ├── api_workspace.test.cjs                # GET/POST/PUT/PATCH/DELETE proxy, auth injection, HTTP errors
│   ├── simulation_lab.test.cjs               # 7 simulation scenarios, BOLA, Excessive Data Exposure, evidence
│   └── ssrf_and_crypto.test.cjs              # SSRF anti-loopback filter & AES-256-GCM encryption vault
├── security_engine_tests/
│   └── test_security_engine.py               # FastAPI OWASP checks (Headers, CORS, Auth, BOLA, BFLA, etc.)
├── monitoring_tests/
│   └── monitoring.test.cjs                   # Health classification, latency thresholds, uptime %, 50-item cap
├── reporting_tests/
│   └── reporting.test.cjs                    # JSON export, binary PDF generation (%PDF-), empty scan handling
├── frontend_tests/
│   └── frontend.test.cjs                     # SeverityBadge, Header, Sidebar & Axios auth interceptor tests
└── test_results/
    ├── test_report.txt                       # Human-readable test summary report
    └── test_report.json                      # Machine-readable JSON test report
```

---

## 💻 How to Open and Run in Visual Studio Code

1. Open **Visual Studio Code**.
2. Click **File → Open Folder...** and select:
   `/Users/michael/Desktop/API_SENTINEL_UNIT_TESTS` (`~/Desktop/API_SENTINEL_UNIT_TESTS`)
   Or open directly from terminal:
   ```bash
   code ~/Desktop/API_SENTINEL_UNIT_TESTS
   ```
3. Open the integrated terminal (**Terminal → New Terminal** or ``Ctrl+` ``).
4. Execute the entire test suite with one command:
   ```bash
   python3 run_tests.py
   ```
   Or using the macOS shell launcher:
   ```bash
   ./run_tests.sh
   ```
5. Run a single suite (optional):
   ```bash
   python3 run_tests.py --suite security_engine_tests
   python3 run_tests.py --suite authentication_tests
   ```

---

## 📦 Dependencies & Isolation

- **Node.js suites (`authentication_tests`, `backend_tests`, `monitoring_tests`, `reporting_tests`, `frontend_tests`)**:
  Use **Node.js built-in test runner (`node:test`)** and read-only resolution of the original project's pre-installed libraries via `Module.createRequire`. **No extra npm install is required.**
- **Python suite (`security_engine_tests`)**:
  Automatically uses the existing `security-engine/venv/bin/python3` environment read-only if present.
  If you ever move this folder to another machine without the original virtualenv, install dependencies *only inside this folder*:
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  python3 run_tests.py
  ```

---

## 📊 Viewing Test Reports

### Interactive Browser Dashboard (Recommended)
Start the standalone cybersecurity report viewer and open it automatically in your browser at `http://127.0.0.1:8765`:
```bash
python3 view_report.py
```
The dashboard reads `test_results/test_report.json` live, supports one-click **Refresh Report** after re-running `python3 run_tests.py`, renders SVG pass-rate charts, and provides direct **View** / **Download** links for `test_report.txt` and `test_report.json`.

### Raw Report Files
After each run, reports are saved in `test_results/`:
- `test_results/test_report.txt` — readable summary, counts, pass percentage, duration, and failure traces.
- `test_results/test_report.json` — structured JSON report for automation or CI parsing.

---

## 🔍 Honest Testing Notes & Verified Source Observations

- **Duplicate API Registration:** Inspection of `backend/src/models/Api.ts` and `backend/src/controllers/apiController.ts` confirms there is no unique constraint or duplicate check rejecting identical API names/base URLs; the unit test verifies actual implemented behavior rather than inventing non-existent validation.
- **JWT Checks in Security Engine:** `security-engine/app/checks/broken_auth.py` checks plaintext HTTP credentials, anonymous access (`200 OK`) on `auth_required` endpoints, and tokens leaked in query parameters. Cryptographic JWT validation (`TokenExpiredError`, tampered signatures) is implemented in `backend/src/middleware/auth.ts` and verified in `authentication_tests/`.
- **Simulation Lab Secure Baseline:** `vulnerable-lab/src/index.js` hosts intentionally vulnerable routes only; the secure BOLA test verifies the expected 403 ownership enforcement pattern against an isolated test server.
