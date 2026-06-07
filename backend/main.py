"""FastAPI application entry point."""
import sys
from pathlib import Path

# Add project root to sys.path so 'backend' module is found when run directly
_project_root = Path(__file__).resolve().parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api import analyze, feedback, pre_engage
from backend.config import API_HOST, API_PORT, DEBUG


app = FastAPI(
    title="ShadowSense Aurora",
    description="AI-powered scam detection system",
    version="1.0.0"
)

# CORS Configuration for extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analyze.router)
app.include_router(feedback.router)
app.include_router(pre_engage.router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "ShadowSense Aurora"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=API_HOST, port=API_PORT, reload=DEBUG)
