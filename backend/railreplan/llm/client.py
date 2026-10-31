"""
LLM Client Interface and Implementations for RailReplan.
Supports GroqClient (primary) and MockLLM (offline fallback).
The LLM is used ONLY for parsing free-text disruptions, RAG answers,
explanations, and alert wording. NEVER for numeric decisions.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from abc import ABC, abstractmethod
from typing import Any, Optional

import httpx
from pydantic import BaseModel

from railreplan.config import get_groq_api_key, get_groq_model, is_llm_available

logger = logging.getLogger(__name__)


class LLMResponse(BaseModel):
    """Standardized LLM response."""
    content: str
    model: str
    usage: dict = {}
    is_mock: bool = False
    latency_ms: float = 0


class LLMClient(ABC):
    """Abstract LLM client interface."""
    
    @abstractmethod
    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 2048,
        response_format: Optional[dict] = None,
    ) -> LLMResponse:
        ...
    
    @abstractmethod
    def get_name(self) -> str:
        ...


class GroqClient(LLMClient):
    """
    Groq API client using the OpenAI-compatible chat completions endpoint.
    Uses structured JSON output validated with Pydantic for extraction.
    Retries with exponential backoff on rate limits.
    """
    
    BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
    MAX_RETRIES = 3
    
    def __init__(self):
        self.api_key = get_groq_api_key()
        self.model = get_groq_model()
        self._client = httpx.AsyncClient(timeout=30.0)
    
    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 2048,
        response_format: Optional[dict] = None,
    ) -> LLMResponse:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        
        if response_format:
            payload["response_format"] = response_format
        
        for attempt in range(self.MAX_RETRIES):
            try:
                start = time.time()
                resp = await self._client.post(
                    self.BASE_URL,
                    headers=headers,
                    json=payload,
                )
                latency = (time.time() - start) * 1000
                
                if resp.status_code == 429:
                    wait = 2 ** (attempt + 1)
                    logger.warning(f"Groq rate limit, waiting {wait}s (attempt {attempt + 1})")
                    await asyncio.sleep(wait)
                    continue
                
                resp.raise_for_status()
                data = resp.json()
                
                return LLMResponse(
                    content=data["choices"][0]["message"]["content"],
                    model=data.get("model", self.model),
                    usage=data.get("usage", {}),
                    is_mock=False,
                    latency_ms=latency,
                )
            
            except httpx.HTTPStatusError as e:
                logger.error(f"Groq API error: {e.response.status_code} - {e.response.text}")
                if attempt == self.MAX_RETRIES - 1:
                    raise
                await asyncio.sleep(2 ** (attempt + 1))
            except Exception as e:
                logger.error(f"Groq request failed: {e}")
                if attempt == self.MAX_RETRIES - 1:
                    raise
                await asyncio.sleep(1)
        
        raise RuntimeError("Groq API failed after retries")
    
    def get_name(self) -> str:
        return f"Groq ({self.model})"


class MockLLM(LLMClient):
    """
    Offline mock LLM that returns pre-scripted responses.
    Ensures the demo works perfectly without API keys.
    """
    
    MOCK_RESPONSES = {
        "parse_disruption": json.dumps({
            "type": "WEATHER_FOG",
            "description": "Dense fog between Gwalior and Jhansi",
            "location_section": ["GWL", "JHS"],
            "severity": "HIGH",
            "speed_cap_kmph": 40,
            "expected_duration_min": 180,
        }),
        "explain_decision": "The optimizer prioritized Vande Bharat and Rajdhani trains due to their higher priority weight (100 and 95 respectively). Mail/Express trains were held at stations with loop lines to allow higher-priority trains to pass. The total delay was minimized by spreading small delays across lower-priority trains rather than creating large delays for any single service.",
        "generate_alert_en": "⚠️ TRAIN ALERT: Your train {train_name} ({train_number}) is delayed by approximately {delay} minutes due to {reason}. Revised arrival at {station}: {new_time}. We apologize for the inconvenience.",
        "generate_alert_hi": "⚠️ ट्रेन अलर्ट: आपकी ट्रेन {train_name} ({train_number}) {reason} के कारण लगभग {delay} मिनट देरी से चल रही है। {station} पर संशोधित आगमन: {new_time}। असुविधा के लिए खेद है।",
        "rag_answer": "According to the Indian Railways Fog Operating Procedure (Section 4.2), when visibility drops below 200m, all trains must reduce speed to 40 km/h maximum. The Loco Pilot must use fog signals and detonators as prescribed. Station Masters must ensure that block instruments are used correctly and no train is admitted until the line is clear.",
        "what_if": "If the track block is extended by 90 minutes, approximately 8 additional trains would be affected. The optimizer would need to hold 3 more trains at intermediate stations and potentially short-terminate 1 passenger train. Estimated additional delay: 450 passenger-minutes.",
    }
    
    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 2048,
        response_format: Optional[dict] = None,
    ) -> LLMResponse:
        # Simulate small latency
        await asyncio.sleep(0.1)
        
        # Try to determine the response type from the messages
        last_msg = messages[-1]["content"].lower() if messages else ""
        
        if "parse" in last_msg or "extract" in last_msg or "disruption" in last_msg:
            content = self.MOCK_RESPONSES["parse_disruption"]
        elif "explain" in last_msg or "why" in last_msg or "reason" in last_msg:
            content = self.MOCK_RESPONSES["explain_decision"]
        elif "hindi" in last_msg or "हिंदी" in last_msg:
            content = self.MOCK_RESPONSES["generate_alert_hi"]
        elif "alert" in last_msg or "notify" in last_msg or "message" in last_msg:
            content = self.MOCK_RESPONSES["generate_alert_en"]
        elif "what if" in last_msg or "scenario" in last_msg:
            content = self.MOCK_RESPONSES["what_if"]
        elif "rag" in last_msg or "knowledge" in last_msg or "sop" in last_msg or "rule" in last_msg:
            content = self.MOCK_RESPONSES["rag_answer"]
        else:
            content = self.MOCK_RESPONSES["explain_decision"]
        
        return LLMResponse(
            content=content,
            model="MockLLM",
            usage={"prompt_tokens": 100, "completion_tokens": 50},
            is_mock=True,
            latency_ms=100,
        )
    
    def get_name(self) -> str:
        return "MockLLM (offline)"


def create_llm_client() -> LLMClient:
    """Factory: returns GroqClient if key is available, else MockLLM."""
    if is_llm_available():
        logger.info("Using Groq LLM client")
        return GroqClient()
    else:
        logger.info("No Groq API key found, using MockLLM")
        return MockLLM()
