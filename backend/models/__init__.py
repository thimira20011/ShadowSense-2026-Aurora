"""Pydantic models for ShadowSense Aurora API schemas.

All public models are re-exported here so callers can import from
``backend.models`` rather than from the individual submodules.
"""
from pydantic import BaseModel

from .analysis import (
    ChatMessage as ChatMessage,
    TrustScore as TrustScore,
    DefenseNarrative as DefenseNarrative,
    ClientProfile as ClientProfile,
    JobPostingRequest as JobPostingRequest,
    PreEngageResponse as PreEngageResponse,
    SimilarJobPattern as SimilarJobPattern,
)

__all__ = [
    "ChatMessage",
    "TrustScore",
    "DefenseNarrative",
    "ClientProfile",
    "JobPostingRequest",
    "PreEngageResponse",
    "SimilarJobPattern",
    "ScamIndicator",
    "AnalysisResult",
    "UserOverride",
]


class ScamIndicator(BaseModel):
    """Detected scam indicator."""
    type: str
    description: str
    confidence: float


class AnalysisResult(BaseModel):
    """Complete analysis result."""
    id: str
    threat_level: str
    confidence: float
    indicators: list[ScamIndicator]
    narrative: str
    timestamp: str


class UserOverride(BaseModel):
    """User feedback override."""
    analysis_id: str
    was_false_positive: bool
    correct_assessment: str
    additional_info: str | None = None
