"""Endpoint for scam analysis requests."""
import asyncio
import uuid
from typing import Any
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from backend.agents.shield import ShieldAgent
from backend.models import ChatMessage, DefenseNarrative, TrustScore
from backend.config import RATE_LIMIT_ANALYZE

router = APIRouter(prefix="/api/analyze", tags=["analysis"])

# Module-level limiter — shares the Limiter instance from app.state
limiter = Limiter(key_func=get_remote_address)

# Single shared ShieldAgent instance (agents are stateless per-request)
shield = ShieldAgent()


class AgentDetails(BaseModel):
    """Raw per-agent outputs included for transparency and debugging."""
    linguistic:       dict[str, Any] = Field(default_factory=dict)
    identity:         dict[str, Any] = Field(default_factory=dict)
    payload:          dict[str, Any] = Field(default_factory=dict)
    similar_patterns: list[Any]      = Field(
        default_factory=list,
        description="Top-k ChromaDB semantic matches (M1 Week-2 checkpoint)",
    )


class AnalysisResponse(BaseModel):
    """Full analysis response including Trust Score, narrative, and agent-level details."""
    analysis_id:        str            = Field(..., description="Unique ID for this analysis event (UUID4)")
    trust_score:        int            = Field(..., description="0 = malicious, 100 = safe")
    verdict:            DefenseNarrative
    agent_details:      AgentDetails | None = Field(
        None, description="Per-agent raw outputs (linguistic, identity, payload)"
    )


@router.post("/", response_model=AnalysisResponse)
@limiter.limit(RATE_LIMIT_ANALYZE)
async def analyze_message(request: Request, message: ChatMessage) -> AnalysisResponse:
    """Analyze a chat message for scam indicators using the multi-agent Shield system.

    The Shield coordinates:
      - LinguisticAgent  (Groq / llama-4-scout)   — urgency, grammar, manipulation
      - IdentityAgent    (Gemini Flash-Lite)        — account age, reviews, verification
      - PayloadAgent     (Ollama DeepSeek-R1)       — file/link threat detection

    Returns analysis_id (UUID4) so the extension can attribute Override+Report
    feedback events to a specific analysis via POST /api/feedback/override.

    Rate limit: RATE_LIMIT_ANALYZE (default 30/minute per IP).
    The shield.defend() call is run in a thread executor so it does not
    block the async event loop during long LLM inference.
    """
    context = {
        "text":      message.text,
        "sender":    message.sender,
        "timestamp": message.timestamp,
        "context":   message.context or {},
    }

    loop   = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, shield.defend, context)

    details = result.get("agent_details")
    agent_details_obj = AgentDetails(**details) if details else None

    return AnalysisResponse(
        analysis_id=str(uuid.uuid4()),
        trust_score=result["trust_score"]["score"],
        verdict=DefenseNarrative(
            trust_score=TrustScore(**result["trust_score"]),
            reasons=result.get("reasons", []),
            suggested_responses=result.get("suggested_responses", []),
        ),
        agent_details=agent_details_obj,
    )
