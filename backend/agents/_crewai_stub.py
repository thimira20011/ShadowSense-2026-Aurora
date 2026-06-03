"""
Temporary stub replacing crewai.Agent during the scaffolding (Week 1) phase.

crewai==1.14.5 requires crewai-core==1.14.5 which is not yet published on PyPI.
This stub preserves the exact constructor signature so swapping back to the real
crewai package later is a one-line change in each agent file.
"""
from typing import Any


class Agent:
    """Minimal drop-in stub for crewai.Agent."""

    def __init__(
        self,
        role: str = "",
        goal: str = "",
        backstory: str = "",
        verbose: bool = False,
        allow_delegation: bool = False,
        **kwargs: Any,
    ) -> None:
        self.role = role
        self.goal = goal
        self.backstory = backstory
        self.verbose = verbose
        self.allow_delegation = allow_delegation
