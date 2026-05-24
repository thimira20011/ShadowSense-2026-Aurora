"""Pydantic models for ShadowSense analysis schemas."""
from pydantic import BaseModel, Field
from typing import List, Optional


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
