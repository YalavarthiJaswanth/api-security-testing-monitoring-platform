from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .models.schemas import ScanRequest, ScanResponse
from .scanner import scanner_instance
import datetime

app = FastAPI(
    title="API Sentinel - Security Testing Engine",
    description="Automated evidence-based OWASP API Security testing microservice",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "api-sentinel-security-engine",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "engine": "FastAPI + HTTPX OWASP Scanner"
    }

@app.post("/scan", response_model=ScanResponse)
async def execute_scan(request: ScanRequest):
    try:
        response = await scanner_instance.run_scan(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scanner execution error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
