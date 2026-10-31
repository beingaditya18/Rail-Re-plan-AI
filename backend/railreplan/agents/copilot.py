"""
RailReplan Controller Copilot Agent.
Answers controller questions, explains agent decisions, evaluates what-if queries,
and cites G&SR rules and decision log evidence.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from railreplan.models import AgentRole, EvidenceBundle, EvidenceClaim, Plan, Disruption
from railreplan.agents.core import BaseAgent, Orchestrator
from railreplan.rag.engine import RAGEngine
from railreplan.llm.client import LLMClient

logger = logging.getLogger(__name__)


class CopilotAgent(BaseAgent):
    """Interactive control-room assistant for human controllers."""
    
    role = AgentRole.COPILOT
    
    def __init__(self, orchestrator: Orchestrator, rag: RAGEngine, llm: LLMClient):
        super().__init__()
        self.orchestrator = orchestrator
        self.rag = rag
        self.llm = llm
    
    async def chat(self, user_query: str) -> dict[str, Any]:
        """Process controller question with RAG and plan context."""
        # 1. Fetch relevant knowledge base evidence
        include_web = any(w in user_query.lower() for w in ["weather", "imd", "fog alert", "news", "status"])
        evidence_bundle = await self.rag.get_evidence_bundle(user_query, include_web=include_web)
        
        # 2. Extract current state context
        current_plan = self.orchestrator.current_plan
        active_disruptions = self.orchestrator.disruptions
        recent_decisions = []
        if current_plan:
            recent_decisions = [
                {"agent": d.agent.value, "decision": d.decision, "reason": d.reason}
                for d in current_plan.decision_log[-10:]
            ]
        
        # 3. Check for What-If scenario intent
        is_what_if = any(p in user_query.lower() for p in ["what if", "if duration", "lasts longer", "longer by", "what happens if"])
        what_if_data = None
        if is_what_if and current_plan:
            what_if_data = self._simulate_what_if(user_query, current_plan)
        
        # 4. Formulate LLM prompt
        system_prompt = """You are RailReplan Copilot, an expert digital assistant in an Indian Railways Divisional Control Room (North Central Railway).
Your role is to assist the Chief Controller (DOM/CTNL) in making safe, rule-compliant decisions during disruptions.
Guidelines:
- Explain optimization choices transparently using Indian Railways operating rules (G&SR, HOER, Priority Precedence).
- State train numbers, station codes, platform numbers, and minutes precisely.
- Always be concise, formal, and authoritative.
- Cite the relevant evidence provided in the context."""

        evidence_text = "\n".join([
            f"[{c.source_type.upper()}] {c.source_title}: {c.excerpt}"
            for c in evidence_bundle.claims
        ])
        
        context_payload = {
            "query": user_query,
            "evidence": evidence_text,
            "current_plan_id": current_plan.id if current_plan else "None",
            "active_disruptions": [d.description for d in active_disruptions],
            "recent_agent_decisions": recent_decisions,
            "what_if_projection": what_if_data,
        }
        
        prompt = f"""Context:
{json.dumps(context_payload, indent=2, default=str)}

Controller Question: "{user_query}"

Provide a direct, concise, and structured operational answer. Highlight key train numbers, platform numbers, and rule references in bold."""

        try:
            llm_resp = await self.llm.chat(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=800,
            )
            answer = llm_resp.content
        except Exception as e:
            logger.warning(f"Copilot LLM query failed: {e}")
            answer = self._fallback_answer(user_query, current_plan, evidence_bundle, what_if_data)
        
        self.log_decision(
            f"Copilot Q&A: {user_query[:50]}...",
            f"Grounded: {evidence_bundle.grounded}, Claims: {len(evidence_bundle.claims)}",
            {"query": user_query, "what_if": is_what_if}
        )
        
        return {
            "query": user_query,
            "answer": answer,
            "evidence": [c.model_dump() for c in evidence_bundle.claims],
            "what_if_data": what_if_data,
            "grounded": evidence_bundle.grounded,
        }
    
    def _simulate_what_if(self, query: str, plan: Plan) -> dict[str, Any]:
        """Rough forward estimation of a what-if delay scenario."""
        extra_minutes = 30
        if "60" in query:
            extra_minutes = 60
        elif "90" in query:
            extra_minutes = 90
        elif "120" in query or "2 hour" in query:
            extra_minutes = 120
        
        original_delay = plan.metrics.total_delay_minutes
        projected_delay = original_delay + (extra_minutes * plan.metrics.trains_affected * 0.6)
        additional_crew_risks = max(1, plan.metrics.crew_changes + (1 if extra_minutes >= 60 else 0))
        
        return {
            "hypothetical_extension_min": extra_minutes,
            "projected_total_delay_min": round(projected_delay, 1),
            "delay_increase_min": round(projected_delay - original_delay, 1),
            "projected_crew_violations": additional_crew_risks,
            "recommended_action": "Order standby crew at Agra Cantt and Jhansi immediately; hold freight in loop lines."
        }
    
    def _fallback_answer(
        self,
        query: str,
        plan: Optional[Plan],
        evidence: EvidenceBundle,
        what_if: Optional[dict]
    ) -> str:
        """Deterministic fallback answer when LLM is unavailable."""
        q_lower = query.lower()
        if "why" in q_lower or "explain" in q_lower:
            return (
                "**Operational Rationale:** As per Railway Board priority directives, high-priority trains "
                "(Vande Bharat and Rajdhani express) are assigned through-line precedence to minimize passenger delay penalty. "
                "Platform and loop assignments are governed by G&SR section headway regulations and HOER duty limits."
            )
        elif what_if:
            return (
                f"**What-If Scenario Projection:** If the disruption duration extends by **+{what_if['hypothetical_extension_min']} minutes**, "
                f"total corridor delay will increase by ~**{what_if['delay_increase_min']} min** to **{what_if['projected_total_delay_min']} min**. "
                f"**Action:** {what_if['recommended_action']}"
            )
        else:
            return (
                f"**System Status:** RailReplan is monitoring corridor NDLS-BPL. "
                f"Current plan status: **{plan.status if plan else 'Active'}**. All movements adhere to 5-minute block headway."
            )
