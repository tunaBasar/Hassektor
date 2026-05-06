"""
MediCopilot AI Agent paketi.

DraftingAgent.run(image_path)  → Türkçe tıbbi rapor taslağı üretir.
SafetyAgent.check(report_text) → Raporu halüsinasyon/tutarsızlık açısından denetler.
"""

from .drafting_agent import DraftingAgent, DraftReport
from .safety_agent import SafetyAgent, SafetyCheckResult

__all__ = ["DraftingAgent", "DraftReport", "SafetyAgent", "SafetyCheckResult"]
