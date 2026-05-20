"""Pydantic models for API schemas."""
from pydantic import BaseModel
from typing import Optional, List


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
    indicators: List[ScamIndicator]
    narrative: str
    timestamp: str


class UserOverride(BaseModel):
    """User feedback override."""
    analysis_id: str
    was_false_positive: bool
    correct_assessment: str
    additional_info: Optional[str] = None
