#!/usr/bin/env python3
"""
API Sentinel Standalone Selenium Automation Launcher
----------------------------------------------------
Verifies application & Chrome availability, launches Chrome via Selenium
(visible by default for live demos, or --headless), runs all 11 Selenium
E2E test modules via the isolated .venv, collects real JUnit XML results
and failure screenshots, and generates HTML, JSON, and TXT reports in reports/.
"""

from __future__ import annotations

import argparse
import datetime
import html
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional

SELENIUM_ROOT = Path(__file__).resolve().parent
REPORTS_DIR = SELENIUM_ROOT / "reports"
SCREENSHOTS_DIR = SELENIUM_ROOT / "screenshots"

ORDERED_TEST_FILES = [
    "tests/test_application.py",
    "tests/test_authentication.py",
    "tests/test_dashboard.py",
    "tests/test_api_inventory.py",
    "tests/test_api_workspace.py",
    "tests/test_vulnerability_scanner.py",
    "tests/test_security_findings.py",
    "tests/test_monitoring.py",
    "tests/test_simulation_lab.py",
    "tests/test_reports.py",
    "tests/test_logout.py",
]


def check_application_available(base_url: str) -> None:
    try:
        req = urllib.request.Request(base_url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status >= 400:
                raise RuntimeError(f"HTTP {resp.status}")
    except Exception as exc:
        print(
            f"\n[ERROR] API Sentinel frontend is not reachable at {base_url} ({exc}).\n"
            "Start the existing platform without modifying or rebuilding it:\n"
            "  cd /Users/michael/.gemini/antigravity/scratch/api-security-testing-monitoring-platform && docker compose up -d\n",
            file=sys.stderr,
        )
        raise SystemExit(2)


def check_chrome_available() -> str:
    mac_chrome = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    if mac_chrome.exists():
        return str(mac_chrome)
    path_chrome = shutil.which("google-chrome") or shutil.which("chromium")
    if path_chrome:
        return path_chrome
    print(
        "[ERROR] Google Chrome browser not found at '/Applications/Google Chrome.app' or in PATH.",
        file=sys.stderr,
    )
    raise SystemExit(3)


def resolve_venv_python() -> str:
    venv_py = SELENIUM_ROOT / ".venv" / "bin" / "python3"
    if venv_py.exists():
        return str(venv_py)
    print(
        "[ERROR] Isolated virtual environment not found at .venv/bin/python3.\n"
        "Create it inside API_SENTINEL_SELENIUM_TESTS with:\n"
        "  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt",
        file=sys.stderr,
    )
    raise SystemExit(4)


def parse_junit_xml(xml_path: Path, run_started_epoch: float) -> List[Dict[str, Any]]:
    if not xml_path.exists() or xml_path.stat().st_size == 0:
        return []

    tree = ET.parse(xml_path)
    root = tree.getroot()
    cases: List[Dict[str, Any]] = []

    for tc in root.iter("testcase"):
        classname = tc.attrib.get("classname", "")
        name = tc.attrib.get("name", "unnamed")
        duration = float(tc.attrib.get("time", "0") or 0)
        failure_el = tc.find("failure")
        error_el = tc.find("error")
        skipped_el = tc.find("skipped")

        status = "PASS"
        message = ""
        error_detail = ""
        screenshot_rel = None

        # Extract any properties attached during test execution
        props = tc.find("properties")
        if props is not None:
            for p in props.findall("property"):
                if p.attrib.get("name") == "screenshot":
                    screenshot_rel = p.attrib.get("value")

        if failure_el is not None or error_el is not None:
            status = "FAIL"
            err_node = failure_el if failure_el is not None else error_el
            message = (err_node.attrib.get("message") or "").strip()
            error_detail = (err_node.text or "").strip()

            if not screenshot_rel:
                safe_name = "".join(c if c.isalnum() or c in ("_", "-") else "_" for c in name)
                matches = sorted(
                    [
                        p
                        for p in SCREENSHOTS_DIR.glob(f"FAIL_{safe_name}_*.png")
                        if p.stat().st_mtime >= run_started_epoch - 2
                    ]
                )
                if matches:
                    screenshot_rel = f"screenshots/{matches[-1].name}"
        elif skipped_el is not None:
            skip_msg = (skipped_el.attrib.get("message") or skipped_el.text or "").strip()
            status = "NOT IMPLEMENTED" if "NOT IMPLEMENTED" in skip_msg.upper() else "SKIPPED"
            message = skip_msg

        cases.append(
            {
                "module": classname,
                "name": name,
                "status": status,
                "duration_seconds": round(duration, 3),
                "message": message,
                "error_detail": error_detail,
                "screenshot": screenshot_rel,
            }
        )

    return cases


def write_reports(report: Dict[str, Any]) -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    json_path = REPORTS_DIR / "selenium_report.json"
    txt_path = REPORTS_DIR / "selenium_report.txt"
    html_path = REPORTS_DIR / "selenium_report.html"

    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    s = report["summary"]
    txt_lines = [
        "=" * 78,
        f"SELENIUM E2E TEST REPORT: {report['project_name']}",
        "=" * 78,
        f"Executed At    : {report['executed_at']}",
        f"Target URL     : {report['base_url']}",
        f"Browser Mode   : {report['browser_mode']}",
        f"Overall Status : {report['overall_status']}",
        "-" * 78,
        f"Total Tests    : {s['total_tests']}",
        f"Passed         : {s['passed_tests']}",
        f"Failed         : {s['failed_tests']}",
        f"Skipped / N.I. : {s['skipped_tests']} (including Not Implemented checks)",
        f"Pass Rate      : {s['pass_percentage']}%",
        f"Duration       : {s['total_duration_seconds']}s",
        "=" * 78,
        "",
    ]
    for tc in report["tests"]:
        txt_lines.append(f"[{tc['status']}] {tc['module']} :: {tc['name']} ({tc['duration_seconds']}s)")
        if tc["message"]:
            txt_lines.append(f"  Note  : {tc['message']}")
        if tc["error_detail"]:
            txt_lines.append(f"  Error : {tc['error_detail']}")
        if tc["screenshot"]:
            txt_lines.append(f"  Shot  : {tc['screenshot']}")
    txt_path.write_text("\n".join(txt_lines) + "\n", encoding="utf-8")

    # Build rich self-contained HTML report
    rows_html = []
    for tc in report["tests"]:
        st = tc["status"]
        if st == "PASS":
            badge = '<span class="badge pass">PASS</span>'
        elif st == "FAIL":
            badge = '<span class="badge fail">FAIL</span>'
        else:
            badge = f'<span class="badge skip">{html.escape(st)}</span>'

        detail_parts = []
        if tc["message"]:
            detail_parts.append(f"<div>{html.escape(tc['message'])}</div>")
        if tc["error_detail"]:
            detail_parts.append(f"<pre class='err'>{html.escape(tc['error_detail'])}</pre>")
        if tc["screenshot"]:
            rel_img = f"../{html.escape(tc['screenshot'])}"
            detail_parts.append(
                f"<div style='margin-top:8px;'><a href='{rel_img}' target='_blank'>"
                f"<img src='{rel_img}' alt='Failure screenshot' class='thumb'/></a></div>"
            )
        details_html = "".join(detail_parts) or "<span class='muted'>Completed cleanly</span>"

        rows_html.append(
            f"<tr>"
            f"<td class='mono'>{html.escape(tc['module'])}</td>"
            f"<td><strong>{html.escape(tc['name'])}</strong></td>"
            f"<td>{badge}</td>"
            f"<td class='mono'>{tc['duration_seconds']}s</td>"
            f"<td>{details_html}</td>"
            f"</tr>"
        )

    milestone_imgs = []
    for img_name in ("scanner_result.png", "simulation_bola.png"):
        p = SCREENSHOTS_DIR / img_name
        if p.exists():
            milestone_imgs.append(
                f"<div class='shot-card'><div class='muted mono' style='margin-bottom:6px;'>{img_name}</div>"
                f"<a href='../screenshots/{img_name}' target='_blank'>"
                f"<img src='../screenshots/{img_name}' class='milestone-img' alt='{img_name}'/></a></div>"
            )

    overall_cls = "pass" if report["overall_status"] == "PASSED" else "fail"
    html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>API Sentinel — Selenium E2E Test Report</title>
  <style>
    body {{ background:#060b16; color:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; margin:0; padding:28px; }}
    .wrap {{ max-width:1280px; margin:0 auto; }}
    .top {{ background:#0f172a; border:1px solid #1e293b; border-radius:14px; padding:20px 24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px; }}
    h1 {{ margin:0; font-size:1.3rem; color:#f8fafc; }}
    .sub {{ color:#94a3b8; font-size:0.84rem; margin-top:4px; }}
    .cards {{ display:grid; grid-template-columns:repeat(6,1fr); gap:12px; margin-bottom:20px; }}
    @media(max-width:960px){{ .cards{{ grid-template-columns:repeat(3,1fr); }} }}
    .card {{ background:#0f172a; border:1px solid #1e293b; border-radius:12px; padding:16px; border-top:3px solid #22d3ee; }}
    .card .lbl {{ font-size:0.72rem; text-transform:uppercase; color:#94a3b8; letter-spacing:0.05em; }}
    .card .val {{ font-size:1.85rem; font-weight:800; margin-top:6px; }}
    .panel {{ background:#0f172a; border:1px solid #1e293b; border-radius:14px; padding:20px; margin-bottom:20px; }}
    table {{ width:100%; border-collapse:collapse; font-size:0.85rem; }}
    th {{ text-align:left; padding:11px 12px; font-size:0.72rem; text-transform:uppercase; color:#94a3b8; background:#0b1224; border-bottom:1px solid #1e293b; }}
    td {{ padding:12px; border-bottom:1px solid #1e293b; vertical-align:top; }}
    .badge {{ display:inline-block; padding:3px 10px; border-radius:999px; font-size:0.72rem; font-weight:700; }}
    .pass {{ background:rgba(16,185,129,0.16); color:#10b981; border:1px solid rgba(16,185,129,0.35); }}
    .fail {{ background:rgba(244,63,94,0.16); color:#f43f5e; border:1px solid rgba(244,63,94,0.4); }}
    .skip {{ background:rgba(245,158,11,0.16); color:#f59e0b; border:1px solid rgba(245,158,11,0.35); }}
    .mono {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:0.78rem; }}
    .muted {{ color:#64748b; font-size:0.8rem; }}
    .err {{ background:#050811; border:1px solid rgba(244,63,94,0.3); color:#fecdd3; padding:10px; border-radius:8px; white-space:pre-wrap; font-family:ui-monospace,monospace; font-size:0.76rem; margin-top:6px; }}
    .thumb {{ max-width:340px; border-radius:8px; border:1px solid #f43f5e; }}
    .shots-grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:16px; }}
    .shot-card {{ background:#0b1224; border:1px solid #1e293b; border-radius:10px; padding:12px; }}
    .milestone-img {{ width:100%; border-radius:8px; border:1px solid #334155; }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>
        <h1>API Sentinel — Selenium E2E Browser Automation Report</h1>
        <div class="sub">Executed: {html.escape(report['executed_at'])} &bull; Target: {html.escape(report['base_url'])} &bull; Browser: {html.escape(report['browser_mode'])}</div>
      </div>
      <span class="badge {overall_cls}" style="font-size:0.85rem; padding:6px 14px;">{html.escape(report['overall_status'])}</span>
    </div>

    <div class="cards">
      <div class="card" style="border-top-color:#3b82f6;"><div class="lbl">Total Tests</div><div class="val">{s['total_tests']}</div></div>
      <div class="card" style="border-top-color:#10b981;"><div class="lbl">Passed</div><div class="val" style="color:#10b981;">{s['passed_tests']}</div></div>
      <div class="card" style="border-top-color:#f43f5e;"><div class="lbl">Failed</div><div class="val" style="color:{'#f43f5e' if s['failed_tests'] > 0 else '#10b981'};">{s['failed_tests']}</div></div>
      <div class="card" style="border-top-color:#f59e0b;"><div class="lbl">Skipped / N.I.</div><div class="val" style="color:#f59e0b;">{s['skipped_tests']}</div></div>
      <div class="card" style="border-top-color:#22d3ee;"><div class="lbl">Pass Rate</div><div class="val" style="color:#22d3ee;">{s['pass_percentage']}%</div></div>
      <div class="card" style="border-top-color:#60a5fa;"><div class="lbl">Execution Time</div><div class="val" style="color:#93c5fd;">{s['total_duration_seconds']}s</div></div>
    </div>

    <div class="panel">
      <h2 style="margin-top:0; font-size:1rem; margin-bottom:14px;">Individual Browser Test Cases</h2>
      <table>
        <thead>
          <tr><th>Module</th><th>Test Name</th><th>Status</th><th>Duration</th><th>Details / Failure Screenshots</th></tr>
        </thead>
        <tbody>
          {''.join(rows_html)}
        </tbody>
      </table>
    </div>

    {f"<div class='panel'><h2 style='margin-top:0; font-size:1rem; margin-bottom:14px;'>Captured Verification Screenshots</h2><div class='shots-grid'>{''.join(milestone_imgs)}</div></div>" if milestone_imgs else ""}
  </div>
</body>
</html>
"""
    html_path.write_text(html_doc, encoding="utf-8")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="API Sentinel Selenium Browser Test Runner")
    parser.add_argument("--headless", action="store_true", help="Run Chrome in headless mode")
    parser.add_argument("--base-url", default=os.getenv("SENTINEL_BASE_URL", "http://localhost:3000"))
    parser.add_argument("--junit-xml", help="Optional path to preserve JUnit XML output (e.g. for CI)")
    parser.add_argument("pytest_args", nargs="*", help="Optional specific pytest targets")
    args = parser.parse_args(argv)

    base_url = args.base_url.rstrip("/")
    check_application_available(base_url)
    chrome_path = check_chrome_available()
    venv_py = resolve_venv_python()

    targets = args.pytest_args if args.pytest_args else ORDERED_TEST_FILES
    browser_mode = "Chrome (Headless)" if args.headless else "Chrome (Visible Demo Mode)"

    print("=" * 72)
    print("API Sentinel — Selenium Browser Automation Suite")
    print("=" * 72)
    print(f"Frontend URL  : {base_url}")
    print(f"Chrome Binary : {chrome_path}")
    print(f"Browser Mode  : {browser_mode}")
    print("=" * 72)

    run_started_epoch = time.time()
    overall_start = time.monotonic()

    with tempfile.TemporaryDirectory(prefix="sentinel_sel_xml_") as tmp:
        junit_xml = Path(tmp) / "selenium_junit.xml"
        cmd = [
            venv_py,
            "-m",
            "pytest",
            f"--base-url={base_url}",
            f"--junit-xml={junit_xml}",
            *targets,
        ]
        if args.headless:
            cmd.append("--headless")

        proc = subprocess.run(cmd, cwd=str(SELENIUM_ROOT))
        total_duration = round(time.monotonic() - overall_start, 3)
        if args.junit_xml and junit_xml.exists():
            dest_xml = Path(args.junit_xml)
            dest_xml.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(junit_xml, dest_xml)
        cases = parse_junit_xml(junit_xml, run_started_epoch)

    total = len(cases)
    passed = sum(1 for c in cases if c["status"] == "PASS")
    failed = sum(1 for c in cases if c["status"] == "FAIL")
    skipped = sum(1 for c in cases if c["status"] in ("SKIPPED", "NOT IMPLEMENTED"))
    executed = total - skipped
    pass_pct = round((passed / executed) * 100.0, 2) if executed > 0 else 0.0

    # If pytest exited non-zero without producing XML failures (e.g. fixture/collection error)
    if proc.returncode != 0 and failed == 0:
        failed = 1
        total = max(total, 1)
        cases.append(
            {
                "module": "pytest",
                "name": "suite_execution",
                "status": "FAIL",
                "duration_seconds": total_duration,
                "message": f"Pytest exited with code {proc.returncode}",
                "error_detail": "Collection or fixture initialization error; see terminal output above.",
                "screenshot": None,
            }
        )

    overall_ok = proc.returncode == 0 and failed == 0 and total > 0

    report = {
        "project_name": "API Security Testing & Monitoring Platform (API Sentinel)",
        "executed_at": datetime.datetime.now().astimezone().isoformat(),
        "base_url": base_url,
        "browser_mode": browser_mode,
        "overall_status": "PASSED" if overall_ok else "FAILED",
        "summary": {
            "total_tests": total,
            "passed_tests": passed,
            "failed_tests": failed,
            "skipped_tests": skipped,
            "pass_percentage": pass_pct,
            "total_duration_seconds": total_duration,
        },
        "tests": cases,
    }

    write_reports(report)

    print(f"\n{'=' * 72}")
    print(f"SELENIUM SUMMARY: Total={total} | Pass={passed} | Fail={failed} | Skip/N.I.={skipped} | Rate={pass_pct}% | Time={total_duration}s")
    print(f"Reports saved to: {REPORTS_DIR}/selenium_report.html (.json, .txt)")
    print(f"{'=' * 72}")

    return 0 if overall_ok else 1


if __name__ == "__main__":
    sys.exit(main())
