"""Endpoint for scam analysis requests."""
from typing import Optional, List, Any, Dict
from fastapi import APIRouter
from pydantic import BaseModel, Field
from backend.agents.shield import ShieldAgent
from backend.models import ChatMessage, DefenseNarrative, TrustScore

router = APIRouter(prefix="/api/analyze", tags=["analysis"])

# Single shared ShieldAgent instance (agents are stateless per-request)
shield = ShieldAgent()


class AgentDetails(BaseModel):
    """Raw per-agent outputs included for transparency and debugging."""
    linguistic:       Dict[str, Any] = Field(default_factory=dict)
    identity:         Dict[str, Any] = Field(default_factory=dict)
    payload:          Dict[str, Any] = Field(default_factory=dict)
    similar_patterns: List[Any]      = Field(
        default_factory=list,
        description="Top-k ChromaDB semantic matches (M1 Week-2 checkpoint)",
    )


class AnalysisResponse(BaseModel):
    """Full analysis response including Trust Score, narrative, and agent-level details."""
    trust_score:        int            = Field(..., description="0 = malicious, 100 = safe")
    verdict:            DefenseNarrative
    agent_details:      Optional[AgentDetails] = Field(
        None, description="Per-agent raw outputs (linguistic, identity, payload)"
    )


@router.post("/", response_model=AnalysisResponse)
async def analyze_message(message: ChatMessage) -> AnalysisResponse:
    """Analyze a chat message for scam indicators using the multi-agent Shield system.

    The Shield coordinates:
      - LinguisticAgent  (Groq / llama-4-scout)   — urgency, grammar, manipulation
      - IdentityAgent    (Gemini Flash-Lite)        — account age, reviews, verification
      - PayloadAgent     (stub → Ollama Week 3)     — file/link threat detection
    """
    context = {
        "text":      message.text,
        "sender":    message.sender,
        "timestamp": message.timestamp,
        "context":   message.context or {},
    }

    result = shield.defend(context)

    details = result.get("agent_details")
    agent_details_obj = AgentDetails(**details) if details else None

    return AnalysisResponse(
        trust_score=result["trust_score"]["score"],
        verdict=DefenseNarrative(
            trust_score=TrustScore(**result["trust_score"]),
            reasons=result.get("reasons", []),
            suggested_responses=result.get("suggested_responses", []),
        ),
        agent_details=agent_details_obj,
    )
