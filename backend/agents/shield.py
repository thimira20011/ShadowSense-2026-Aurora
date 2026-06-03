"""Shield agent for coordinating defense responses."""
from typing import Dict, Any, List
from ._crewai_stub import Agent  # TODO: replace with `from crewai import Agent` once crewai-core is on PyPI
from .linguistic import LinguisticAgent
from .identity import IdentityAgent
from .payload import PayloadAgent


class ShieldAgent:
    """Orchestrates multi-agent defense responses."""
    
    def __init__(self) -> None:
        self.agent = Agent(
            role="Defense Shield Coordinator",
            goal="Coordinate comprehensive scam detection, synthesize agent findings, and determine defense responses",
            backstory="Senior security analyst overseeing all threat intelligence feeds, managing defense posture, and advising on mitigation strategy.",
            verbose=True,
            allow_delegation=True
        )
        self.linguistic = LinguisticAgent()
        self.identity = IdentityAgent()
        self.payload = PayloadAgent()
    
    def defend(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute comprehensive defense against detected threats."""
        text = context.get("text", "")
        
        # Analyze linguistic
        linguistic_res = self.linguistic.analyze(text)
        linguistic_urgency = linguistic_res.get("urgency_score", 0.0)
        
        # Verify identity
        identity_data = context.get("context", {})
        if "sender" in context:
            identity_data["sender"] = context["sender"]
        identity_res = self.identity.verify(identity_data)
        identity_risk = identity_res.get("identity_risk", 0.0)
        
        # Analyze payload
        payload_file = context.get("context", {}).get("filename", "")
        payload_res = self.payload.analyze(payload_file)
        payload_risk = payload_res.get("payload_risk", 0.0)
        
        # Calculate weighted score (Trust score: 0 = malicious, 100 = safe)
        weighted_risk = (0.4 * linguistic_urgency) + (0.3 * identity_risk) + (0.3 * payload_risk)
        score = max(0, min(100, int(100 - weighted_risk)))
        
        # Determine intervention level
        if score >= 70:
            level = "CLEAR"
            explanation = "Conversation is clear. No major indicators of risk detected."
        elif score >= 40:
            level = "ADVISORY"
            explanation = "Moderate risk signals detected. Exercise caution."
        else:
            level = "HIGH_RISK"
            explanation = "High-risk patterns detected. Communication matches known scam templates."
            
        # Collect reasons
        reasons = []
        for flag in linguistic_res.get("red_flags", []):
            reasons.append(f"Linguistic Analyst: {flag} detected.")
        for anomaly in identity_res.get("anomalies", []):
            reasons.append(f"Identity Profiler: {anomaly}")
        for threat in payload_res.get("threats", []):
            reasons.append(f"Payload Auditor: {threat}")
            
        if not reasons or (len(reasons) == 1 and reasons[0] == ""):
            reasons = ["No threat indicators identified by agents."]
            
        # Suggested response templates
        if score >= 70:
            suggested_responses = [
                "I would be happy to help with this project. Can you provide the specifications?",
                "Thanks for the offer. I look forward to working together."
            ]
        elif score >= 40:
            suggested_responses = [
                "Thank you. Please share all project details directly on the platform.",
                "Let's discuss the scope of work here before proceeding."
            ]
        else:
            suggested_responses = [
                "Thank you for reaching out. Please share all project files through the platform's official attachment system. I do not accept files via third-party download links.",
                "Please note that all payments and communications must remain on this platform to comply with the terms of service."
            ]
            
        return {
            "trust_score": {
                "score": score,
                "level": level,
                "explanation": explanation
            },
            "reasons": reasons,
            "suggested_responses": suggested_responses
        }
