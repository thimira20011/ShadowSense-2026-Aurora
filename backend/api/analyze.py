"""Endpoint for scam analysis requests."""
from fastapi import APIRouter
from pydantic import BaseModel
from backend.agents.shield import ShieldAgent
from backend.models import ChatMessage, DefenseNarrative

router = APIRouter(prefix="/api/analyze", tags=["analysis"])
shield = ShieldAgent()


class AnalysisResponse(BaseModel):
    """Response schema for scam analysis, supporting simple and rich formats."""
    trust_score: int
    verdict: DefenseNarrative


@router.post("/", response_model=AnalysisResponse)
async def analyze_message(message: ChatMessage) -> AnalysisResponse:
    """Analyze a chat message for scam indicators using the multi-agent Shield system."""
    # Convert request model to context dictionary for ShieldAgent
    context = {
        "text": message.text,
        "sender": message.sender,
        "timestamp": message.timestamp,
        "context": message.context or {}
    }
    
    # Run the comprehensive multi-agent defense assessment
    narrative_data = shield.defend(context)
    
    return AnalysisResponse(
        trust_score=narrative_data["trust_score"]["score"],
        verdict=DefenseNarrative(**narrative_data)
    )

