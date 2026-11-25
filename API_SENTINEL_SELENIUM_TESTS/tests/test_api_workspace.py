import json
from pages.api_workspace_page import ApiWorkspacePage


def test_api_workspace_get_jsonplaceholder_real_response(authenticated_driver, base_url):
    """TEST 6a: Send GET request to JSONPlaceholder via API Workspace and inspect real response."""
    ws = ApiWorkspacePage(authenticated_driver, base_url)
    ws.open_workspace()

    ws.send_request("GET", "https://jsonplaceholder.typicode.com/posts/1")

    status = ws.get_status_text()
    duration = ws.get_duration_text()
    body = ws.get_response_body()

    assert status.startswith("200"), f"Expected HTTP 200 status, got: {status}"
    assert "ms" in duration, f"Expected response time in ms, got: {duration}"
    parsed = json.loads(body)
    assert parsed["id"] == 1
    assert "title" in parsed and "body" in parsed


def test_api_workspace_post_jsonplaceholder_real_response(authenticated_driver, base_url):
    """TEST 6b: Send POST request to JSONPlaceholder via API Workspace and inspect HTTP 201 response."""
    ws = ApiWorkspacePage(authenticated_driver, base_url)
    ws.open_workspace()

    payload = json.dumps({"title": "API Sentinel Selenium Test", "body": "E2E POST probe", "userId": 42})
    ws.send_request("POST", "https://jsonplaceholder.typicode.com/posts", json_body=payload)

    status = ws.get_status_text()
    duration = ws.get_duration_text()
    body = ws.get_response_body()

    assert status.startswith("201"), f"Expected HTTP 201 Created, got: {status}"
    assert "ms" in duration
    parsed = json.loads(body)
    assert parsed["title"] == "API Sentinel Selenium Test"
    assert parsed["userId"] == 42
