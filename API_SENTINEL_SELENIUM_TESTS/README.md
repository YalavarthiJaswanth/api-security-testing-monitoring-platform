# API Sentinel — Standalone Selenium Browser Automation Suite

This directory is a **completely isolated Selenium WebDriver end-to-end testing suite** for the **API Security Testing & Monitoring Platform (API Sentinel)**.

It automates real Google Chrome interactions against the live running web application without modifying any source code, dependencies, Docker, Jenkins, Kubernetes, or unit test files.

---

## 📁 Structure

```text
API_SENTINEL_SELENIUM_TESTS/
├── .venv/                         # Isolated Python virtual environment (Selenium + pytest)
├── .env.example                   # Optional environment configuration template
├── pytest.ini                     # Pytest configuration
├── requirements.txt               # Isolated Python dependencies
├── run_tests.py                   # Master launcher & HTML/JSON/TXT report generator
├── conftest.py                    # Chrome WebDriver lifecycle, isolated test user & failure screenshots
├── pages/                         # Page Object Model classes matching real frontend JSX selectors
│   ├── base_page.py
│   ├── login_page.py
│   ├── dashboard_page.py
│   ├── api_inventory_page.py
│   ├── api_workspace_page.py
│   ├── scanner_page.py
│   ├── findings_page.py
│   ├── monitoring_page.py
│   ├── simulation_page.py
│   └── reports_page.py
├── tests/                         # 11 End-to-End Browser Test Modules (Tests 1–12)
├── reports/                       # selenium_report.html, selenium_report.json, selenium_report.txt, downloads/
└── screenshots/                   # Milestone & failure screenshots
```

---

## 🚀 Prerequisites (Start API Sentinel First)

Ensure API Sentinel is running at `http://localhost:3000`:
```bash
cd /Users/michael/.gemini/antigravity/scratch/api-security-testing-monitoring-platform
docker compose up -d
```

---

## ▶️ Running Selenium Tests

### Visible Chrome Demo Mode (Default)
```bash
cd ~/Desktop/API_SENTINEL_SELENIUM_TESTS
python3 run_tests.py
```

### Headless Mode (CI / Background)
```bash
cd ~/Desktop/API_SENTINEL_SELENIUM_TESTS
python3 run_tests.py --headless
```

### Optional Custom Credentials
By default, the test runner registers a **fresh isolated test user (`selenium_qa_<timestamp>`)** with a runtime-generated random password so existing user accounts and data are never modified. To use specific existing credentials instead, copy `.env.example` to `.env` and set `SENTINEL_TEST_USERNAME` and `SENTINEL_TEST_PASSWORD`.

---

## 📊 Viewing Reports

Open the generated HTML report in Chrome or VS Code:
```bash
open ~/Desktop/API_SENTINEL_SELENIUM_TESTS/reports/selenium_report.html
```
