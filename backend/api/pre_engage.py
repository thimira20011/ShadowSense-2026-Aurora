"""Endpoint for pre-engagement job listing analysis (Fiverr / Upwork)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from backend.models import JobPostingRequest, PreEngageResponse
from backend.agents.job_risk import JobRiskAgent

router = APIRouter(prefix="/api/pre-engage", tags=["pre-engagement"])

# Single shared instance (stateless per-request)
_job_risk_agent = JobRiskAgent()


@router.post("/", response_model=PreEngageResponse)
async def analyze_job_posting(request: JobPostingRequest) -> PreEngageResponse:
    """
    Analyse a Fiverr or Upwork job listing **before** the freelancer applies.

    Pipeline:
      1. Embed job title + description via sentence-transformers (all-MiniLM-L6-v2).
      2. Query ChromaDB ``job_scam_patterns`` for semantically similar fraudulent templates.
      3. Score client profile metadata (account age, reviews, spend, verification).
      4. Run keyword heuristics (off-platform payment, WhatsApp redirect, crypto, etc.).
      5. Return Pre-Engagement Trust Score 0–100 with verdict + red flags.

    | Score  | Verdict        | Badge    |
    |--------|----------------|----------|
    | 70-100 | VERIFIED_SAFE  | 🟢 Green |
    | 40-69  | MODERATE_RISK  | 🟡 Amber |
    | 0-39   | HIGH_RISK      | 🔴 Red   |
    """
    if not request.job_description or not request.job_description.strip():
        raise HTTPException(
            status_code=422,
            detail="job_description must be a non-empty string.",
        )

    client_profile_dict = {}
    if request.client_profile:
        client_profile_dict = request.client_profile.model_dump(exclude_none=True)

    result = _job_risk_agent.score(
        platform=request.platform,
        job_url=request.job_url,
        job_title=request.job_title,
        job_description=request.job_description,
        budget=request.budget,
        client_profile=client_profile_dict,
    )

    return PreEngageResponse(**result)


class QuickJobPostingRequest(BaseModel):
    """Payload for quick pre-engagement analysis request."""
    job_text: str = Field(..., description="The content of the job listing to analyze")
    client_profile: dict | None = Field(default_factory=dict, description="Scraped client/buyer profile metadata")


@router.post("/quick", response_model=PreEngageResponse)
async def analyze_quick_job_posting(request: QuickJobPostingRequest) -> PreEngageResponse:
    """
    Analyse a job text quickly without needing full structured job listing details.
    """
    if not request.job_text or not request.job_text.strip():
        raise HTTPException(
            status_code=422,
            detail="job_text must be a non-empty string.",
        )

    from backend.agents.job_risk import analyze_job_listing

    result = analyze_job_listing(
        job_text=request.job_text,
        client_profile=request.client_profile,
    )

    return PreEngageResponse(**result)

