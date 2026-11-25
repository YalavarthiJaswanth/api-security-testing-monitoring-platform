#!/usr/bin/env python3
"""
API Sentinel Standalone Unit Test Launcher
------------------------------------------
Discovers and runs all isolated unit test suites across Authentication,
Backend API Management/Workspace/Simulation, Python Security Engine,
API Monitoring, Reporting, and Frontend Components without modifying the
original API Sentinel source directory.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional

TEST_PKG_ROOT = Path(__file__).resolve().parent
DEFAULT_PROJECT_ROOT = (
    TEST_PKG_ROOT.parent
    if (TEST_PKG_ROOT.parent / "backend" / "package.json").exists()
    else Path("/Users/michael/.gemini/antigravity/scratch/api-security-testing-monitoring-platform")
)
ORIGINAL_PROJECT_ROOT = Path(
    os.environ.get(
        "API_SENTINEL_ROOT",
        str(DEFAULT_PROJECT_ROOT),
    )
)
RESULTS_DIR = TEST_PKG_ROOT / "test_results"

SUITE_CATALOG = [
    {
        "name": "authentication_tests",
        "runner": "node",
        "pattern": "*.test.cjs",
        "source_modules": [
            "backend/src/controllers/authController.ts",
            "backend/src/middleware/auth.ts",
            "backend/src/models/User.ts",
        ],
    },
    {
        "name": "backend_tests",
        "runner": "node",
        "pattern": "*.test.cjs",
        "source_modules": [
            "backend/src/controllers/apiController.ts",
            "backend/src/controllers/testController.ts",
            "backend/src/controllers/simulationController.ts",
            "backend/src/services/apiTester.ts",
            "backend/src/services/openapiParser.ts",
            "backend/src/utils/ssrf.ts",
            "backend/src/utils/crypto.ts",
        ],
    },
    {
        "name": "security_engine_tests",
        "runner": "pytest",
        "pattern": "test_*.py",
        "source_modules": [
            "security-engine/app/main.py",
            "security-engine/app/scanner.py",
            "security-engine/app/checks/headers_cors.py",
            "security-engine/app/checks/broken_auth.py",
            "security-engine/app/checks/sensitive_data.py",
            "security-engine/app/checks/resource_consumption.py",
            "security-engine/app/checks/bola.py",
            "security-engine/app/checks/bfla.py",
            "security-engine/app/checks/inventory.py",
        ],
    },
    {
        "name": "monitoring_tests",
        "runner": "node",
        "pattern": "*.test.cjs",
        "source_modules": [
            "backend/src/services/monitoringWorker.ts",
            "backend/src/controllers/monitoringController.ts",
            "backend/src/models/Monitoring.ts",
        ],
    },
    {
        "name": "reporting_tests",
        "runner": "node",
        "pattern": "*.test.cjs",
        "source_modules": [
            "backend/src/controllers/reportController.ts",
        ],
    },
    {
        "name": "frontend_tests",
        "runner": "node",
        "pattern": "*.test.cjs",
        "source_modules": [
            "frontend/src/components/SeverityBadge.tsx",
            "frontend/src/components/Header.tsx",
            "frontend/src/components/Sidebar.tsx",
            "frontend/src/services/api.ts",
        ],
    },
]


def resolve_python_for_pytest() -> str:
    """Resolve Python interpreter with pytest without mutating the original project."""
    local_venv_py = TEST_PKG_ROOT / ".venv" / "bin" / "python3"
    if local_venv_py.exists():
        return str(local_venv_py)

    readonly_engine_py = ORIGINAL_PROJECT_ROOT / "security-engine" / "venv" / "bin" / "python3"
    if readonly_engine_py.exists():
        return str(readonly_engine_py)

    return sys.executable


def discover_files(suite_dir: Path, pattern: str) -> List[Path]:
    if not suite_dir.exists():
        return []
    return sorted(suite_dir.glob(pattern))


def parse_junit_xml(xml_path: Path) -> Dict[str, Any]:
    """Extract per-test counts and failure diagnostics from a JUnit XML file."""
    if not xml_path.exists() or xml_path.stat().st_size == 0:
        return {"total": 0, "passed": 0, "failed": 0, "skipped": 0, "failures": []}

    tree = ET.parse(xml_path)
    root = tree.getroot()

    total = 0
    passed = 0
    failed = 0
    skipped = 0
    failures: List[Dict[str, str]] = []

    for tc in root.iter("testcase"):
        total += 1
        name = tc.attrib.get("name", "unnamed_test")
        classname = tc.attrib.get("classname", "")
        failure_el = tc.find("failure")
        error_el = tc.find("error")
        skipped_el = tc.find("skipped")

        if failure_el is not None or error_el is not None:
            failed += 1
            err_node = failure_el if failure_el is not None else error_el
            msg = err_node.attrib.get("message", "").strip()
            detail = (err_node.text or "").strip()
            failures.append(
                {
                    "test_name": f"{classname} :: {name}" if classname else name,
                    "description": msg or "Assertion or runtime failure",
                    "error_message": detail or msg or "No error details captured",
                }
            )
        elif skipped_el is not None:
            skipped += 1
        else:
            passed += 1

    return {
        "total": total,
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
        "failures": failures,
    }


def run_suite(suite: Dict[str, Any], tmp_dir: Path, junit_dir: Optional[Path] = None) -> Dict[str, Any]:
    suite_name = suite["name"]
    suite_dir = TEST_PKG_ROOT / suite_name
    test_files = discover_files(suite_dir, suite["pattern"])
    xml_out = tmp_dir / f"{suite_name}.xml"

    print(f"\n{'=' * 72}")
    print(f"RUNNING SUITE: {suite_name} ({len(test_files)} file(s))")
    print(f"{'=' * 72}")

    if not test_files:
        return {
            "suite": suite_name,
            "files": [],
            "source_modules": suite["source_modules"],
            "total": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "pass_percentage": 0.0,
            "duration_seconds": 0.0,
            "exit_code": 0,
            "failures": [],
            "status": "SKIPPED_NO_FILES",
        }

    env = os.environ.copy()
    env["API_SENTINEL_ROOT"] = str(ORIGINAL_PROJECT_ROOT)

    if suite["runner"] == "node":
        node_bin = shutil.which("node")
        if not node_bin:
            raise RuntimeError("Node.js binary not found in PATH")
        cmd = [
            node_bin,
            "--test",
            "--test-reporter=spec",
            "--test-reporter-destination=stdout",
            "--test-reporter=junit",
            f"--test-reporter-destination={xml_out}",
            *[str(f) for f in test_files],
        ]
    elif suite["runner"] == "pytest":
        py_bin = resolve_python_for_pytest()
        cmd = [
            py_bin,
            "-m",
            "pytest",
            "-v",
            "--tb=short",
            f"--junit-xml={xml_out}",
            *[str(f) for f in test_files],
        ]
    else:
        raise ValueError(f"Unsupported test runner: {suite['runner']}")

    start = time.monotonic()
    proc = subprocess.run(cmd, cwd=str(TEST_PKG_ROOT), env=env)
    duration = round(time.monotonic() - start, 3)

    if junit_dir is not None and xml_out.exists():
        junit_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(xml_out, junit_dir / f"{suite_name}.xml")

    parsed = parse_junit_xml(xml_out)
    total = parsed["total"]
    passed = parsed["passed"]
    failed = parsed["failed"]
    skipped = parsed["skipped"]
    failures = parsed["failures"]

    # If the runner exited non-zero without producing XML failures (e.g. module import crash)
    if proc.returncode != 0 and failed == 0:
        failed = 1
        total = max(total, 1)
        failures.append(
            {
                "test_name": f"{suite_name} (Suite Execution)",
                "description": f"Test runner exited with code {proc.returncode}",
                "error_message": f"Process failed with exit code {proc.returncode}. Check terminal output above.",
            }
        )

    executed = total - skipped
    pass_pct = round((passed / executed) * 100.0, 2) if executed > 0 else 0.0

    return {
        "suite": suite_name,
        "files": [str(f.relative_to(TEST_PKG_ROOT)) for f in test_files],
        "source_modules": suite["source_modules"],
        "total": total,
        "passed": passed,
        "failed": failed,
        "skipped": skipped,
        "pass_percentage": pass_pct,
        "duration_seconds": duration,
        "exit_code": proc.returncode,
        "failures": failures,
        "status": "PASSED" if proc.returncode == 0 and failed == 0 else "FAILED",
    }


def write_reports(report: Dict[str, Any]) -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    json_path = RESULTS_DIR / "test_report.json"
    txt_path = RESULTS_DIR / "test_report.txt"

    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    lines = [
        "=" * 78,
        f"TEST REPORT: {report['project_name']}",
        "=" * 78,
        f"Execution Timestamp : {report['executed_at']}",
        f"Original Project    : {report['original_project_path']} (READ-ONLY)",
        f"Test Package        : {report['test_package_path']}",
        f"Overall Status      : {report['overall_status']}",
        "-" * 78,
        f"Total Tests         : {report['summary']['total_tests']}",
        f"Passed Tests        : {report['summary']['passed_tests']}",
        f"Failed Tests        : {report['summary']['failed_tests']}",
        f"Skipped Tests       : {report['summary']['skipped_tests']}",
        f"Pass Percentage     : {report['summary']['pass_percentage']}%",
        f"Execution Duration  : {report['summary']['total_duration_seconds']}s",
        "=" * 78,
        "",
        "SUITE BREAKDOWN",
        "-" * 78,
    ]

    for s in report["suites"]:
        lines.extend(
            [
                f"Suite          : {s['suite']} [{s['status']}]",
                f"  Test Files   : {', '.join(s['files']) or 'None'}",
                f"  Counts       : Total={s['total']} | Passed={s['passed']} | Failed={s['failed']} | Skipped={s['skipped']} ({s['pass_percentage']}%)",
                f"  Duration     : {s['duration_seconds']}s",
                f"  Source Scope : {', '.join(s['source_modules'])}",
            ]
        )
        if s["failures"]:
            lines.append("  Failures     :")
            for idx, fail in enumerate(s["failures"], start=1):
                lines.append(f"    {idx}. {fail['test_name']}")
                lines.append(f"       Description : {fail['description']}")
                lines.append(f"       Error       : {fail['error_message']}")
        lines.append("-" * 78)

    txt_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="API Sentinel Standalone Unit Test Runner")
    parser.add_argument(
        "--suite",
        action="append",
        help="Run only the specified suite name (can be repeated)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List discovered test suites and files without executing",
    )
    parser.add_argument(
        "--junit-dir",
        help="Optional directory to preserve suite JUnit XML files (e.g. for CI)",
    )
    args = parser.parse_args(argv)

    selected_suites = SUITE_CATALOG
    if args.suite:
        requested = set(args.suite)
        selected_suites = [s for s in SUITE_CATALOG if s["name"] in requested]
        unknown = requested - {s["name"] for s in selected_suites}
        if unknown:
            print(f"Unknown test suite(s): {', '.join(sorted(unknown))}", file=sys.stderr)
            return 2

    if args.list:
        for s in selected_suites:
            files = discover_files(TEST_PKG_ROOT / s["name"], s["pattern"])
            print(f"{s['name']} ({s['runner']}):")
            for f in files:
                print(f"  - {f.relative_to(TEST_PKG_ROOT)}")
        return 0

    overall_start = time.monotonic()
    suite_results: List[Dict[str, Any]] = []

    junit_dir = Path(args.junit_dir) if args.junit_dir else None
    with tempfile.TemporaryDirectory(prefix="api_sentinel_junit_") as tmp:
        tmp_path = Path(tmp)
        for suite in selected_suites:
            result = run_suite(suite, tmp_path, junit_dir=junit_dir)
            suite_results.append(result)

    total_duration = round(time.monotonic() - overall_start, 3)
    total_tests = sum(s["total"] for s in suite_results)
    passed_tests = sum(s["passed"] for s in suite_results)
    failed_tests = sum(s["failed"] for s in suite_results)
    skipped_tests = sum(s["skipped"] for s in suite_results)
    executed_tests = total_tests - skipped_tests
    pass_percentage = round((passed_tests / executed_tests) * 100.0, 2) if executed_tests > 0 else 0.0
    overall_ok = failed_tests == 0 and total_tests > 0 and all(s["exit_code"] == 0 for s in suite_results)

    report = {
        "project_name": "API Security Testing & Monitoring Platform (API Sentinel)",
        "executed_at": datetime.datetime.now().astimezone().isoformat(),
        "original_project_path": str(ORIGINAL_PROJECT_ROOT),
        "test_package_path": str(TEST_PKG_ROOT),
        "overall_status": "PASSED" if overall_ok else "FAILED",
        "summary": {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "skipped_tests": skipped_tests,
            "pass_percentage": pass_percentage,
            "total_duration_seconds": total_duration,
        },
        "suites": suite_results,
    }

    write_reports(report)

    print(f"\n{'=' * 72}")
    print("API SENTINEL UNIT TEST SUMMARY")
    print(f"{'=' * 72}")
    for s in suite_results:
        print(
            f"  {s['suite']:24s} | {s['status']:6s} | "
            f"Pass: {s['passed']:2d}/{s['total']:2d} | Fail: {s['failed']:2d} | Skip: {s['skipped']:2d} | {s['duration_seconds']}s"
        )
    print("-" * 72)
    print(
        f"  TOTAL: {total_tests} | PASSED: {passed_tests} | FAILED: {failed_tests} | "
        f"SKIPPED: {skipped_tests} | PASS RATE: {pass_percentage}% | TIME: {total_duration}s"
    )
    print(f"  Reports written to: {RESULTS_DIR}/test_report.txt and test_report.json")
    print(f"{'=' * 72}")

    return 0 if overall_ok else 1


if __name__ == "__main__":
    sys.exit(main())
