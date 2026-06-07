"""Pydantic models for ShadowSense analysis schemas."""
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


class ChatMessage(BaseModel):
    """Represents a chat message sent by a client or freelancer."""
    text: str = Field(..., description="The content of the message to analyze")
    sender: Optional[str] = Field(None, description="The name/identifier of the message sender")
    timestamp: Optional[str] = Field(None, description="The timestamp of the message")
    context: Optional[dict] = Field(default_factory=dict, description="Additional context metadata")


class TrustScore(BaseModel):
    """Represents the computed trust score and assessment level."""
    score: int = Field(..., ge=0, le=100, description="Trust score ranging from 0 (malicious) to 100 (safe)")
    level: str = Field(..., description="Intervention level: 'CLEAR' (70-100), 'ADVISORY' (40-69), or 'HIGH_RISK' (0-39)")
    explanation: str = Field(..., description="High-level narrative explaining the trust assessment")


class DefenseNarrative(BaseModel):
    """The final structured analysis payload containing the verdict and defense strategy."""
    trust_score: TrustScore = Field(..., description="The calculated trust score details")
    reasons: List[str] = Field(default_factory=list, description="Bullet points explaining why this score was given")
    suggested_responses: List[str] = Field(default_factory=list, description="Suggested safe and professional templates for the freelancer")


# ---------------------------------------------------------------------------
# Pre-Engagement (Job Listing) Models
# ---------------------------------------------------------------------------

class ClientProfile(BaseModel):
    """Scraped client/buyer profile metadata from Fiverr or Upwork listing pages."""
    reviews: Optional[int] = Field(None, ge=0, description="Total number of client reviews")
    rating: Optional[float] = Field(None, ge=0.0, le=5.0, description="Average client rating 0-5")
    total_spend: Optional[float] = Field(None, ge=0, description="Total amount spent on the platform (USD)")
    member_since_days: Optional[int] = Field(None, ge=0, description="Days since the client account was created")
    country: Optional[str] = Field(None, description="Client's listed country")
    verified: Optional[bool] = Field(None, description="Whether the client account is payment-verified")
    level: Optional[str] = Field(None, description="Client level badge if present (e.g. 'Level 2', 'Top Rated')")
    hire_rate: Optional[float] = Field(None, ge=0.0, le=100.0, description="Upwork hire rate percentage")
    jobs_posted: Optional[int] = Field(None, ge=0, description="Total jobs posted by this client")


class JobPostingRequest(BaseModel):
    """Full pre-engagement analysis request - job listing scraped from Fiverr or Upwork."""
    platform: str = Field(..., description="Source platform: 'fiverr' or 'upwork'")
    job_url: str = Field(..., description="Canonical URL of the job/gig listing")
    job_title: str = Field(..., description="Title of the job posting or gig")
    job_description: str = Field(..., description="Full text of the job description or gig requirements")
    budget: Optional[str] = Field(None, description="Listed budget or price (raw string)")
    client_profile: Optional[ClientProfile] = Field(
        default_factory=ClientProfile,
        description="Scraped client/buyer profile metadata",
    )


class SimilarJobPattern(BaseModel):
    """A semantically similar scam pattern retrieved from ChromaDB."""
    text: str
    similarity: float = Field(..., ge=0.0, le=1.0)
    type: str
    category: str
    severity: int = Field(..., ge=1, le=10)
    red_flags: List[str] = Field(default_factory=list)


class PreEngageResponse(BaseModel):
    """Pre-engagement trust analysis result returned to the extension before any application."""
    pre_engage_score: int = Field(
        ..., ge=0, le=100,
        description="Pre-Engagement Trust Score: 0 = certain scam, 100 = verified safe",
    )
    verdict: str = Field(
        ..., description="'VERIFIED_SAFE' | 'MODERATE_RISK' | 'HIGH_RISK'",
    )
    confidence: float = Field(..., ge=0.0, le=1.0, description="Overall confidence in the verdict")
    red_flags: List[str] = Field(default_factory=list, description="Human-readable risk flags")
    similar_patterns: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Top ChromaDB semantic matches from the job_scam_patterns collection",
    )
    client_risk_breakdown: Dict[str, Any] = Field(
        default_factory=dict,
        description="Per-signal breakdown of the client profile risk score",
    )
    platform: str = Field(..., description="Source platform that was analyzed")
    job_url: str = Field(..., description="The URL that was analyzed")
