from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ParameterSchema(BaseModel):
    name: str
    in_: str = Field('query', alias='in')
    required: bool = False
    type: Optional[str] = 'string'
    description: Optional[str] = ''

class EndpointItem(BaseModel):
    path: str
    method: str = 'GET'
    parameters: Optional[List[Dict[str, Any]]] = []
    auth_required: Optional[bool] = False

class AuthPayload(BaseModel):
    auth_type: str = 'none'
    token: Optional[str] = None
    api_key: Optional[str] = None
    api_key_header: Optional[str] = 'X-API-Key'
    username: Optional[str] = None
    password: Optional[str] = None

class ScanRequest(BaseModel):
    scan_id: str
    scan_type: str = 'full_owasp'
    base_url: str
    is_lab: bool = False
    endpoints: List[EndpointItem] = []
    auth: Optional[AuthPayload] = None

class FindingSchema(BaseModel):
    title: str
    owasp_category: str
    severity: str  # critical, high, medium, low, informational
    endpoint: str
    method: str
    evidence: Dict[str, Any]
    explanation: str
    potential_impact: str
    remediation: str
    confidence: str = 'probable'  # confirmed, probable, potential

class ScanResponse(BaseModel):
    scan_id: str
    status: str
    duration_ms: int
    endpoints_tested: int
    findings_count: int
    findings: List[FindingSchema]
