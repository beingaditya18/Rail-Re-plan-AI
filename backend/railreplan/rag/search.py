"""
Serper API Search Client with SQLite caching and offline fallback fixtures.
Safeguards search budget with 30-minute TTL and local cache.
"""
from __future__ import annotations

import hashlib
import json
import logging
import sqlite3
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import httpx

from railreplan.config import get_serper_api_key, is_search_available

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "cache"
CACHE_DB = CACHE_DIR / "serper_cache.sqlite"


class SerperClient:
    """Client for Google Search via Serper API with local caching."""
    
    BASE_URL = "https://google.serper.dev/search"
    TTL_SECONDS = 1800  # 30 minutes
    
    def __init__(self):
        self.api_key = get_serper_api_key()
        self._init_cache()
    
    def _init_cache(self):
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(CACHE_DB) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS search_cache (
                    query_hash TEXT PRIMARY KEY,
                    query TEXT,
                    response_json TEXT,
                    cached_at REAL
                )
            """)
            conn.commit()
    
    def _get_from_cache(self, query: str) -> Optional[dict]:
        qhash = hashlib.sha256(query.strip().lower().encode()).hexdigest()
        now = time.time()
        with sqlite3.connect(CACHE_DB) as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT response_json, cached_at FROM search_cache WHERE query_hash = ?",
                (qhash,)
            )
            row = cur.fetchone()
            if row:
                resp_json, cached_at = row
                if now - cached_at < self.TTL_SECONDS:
                    logger.info(f"Serper cache HIT for query: '{query}'")
                    return json.loads(resp_json)
        return None
    
    def _save_to_cache(self, query: str, data: dict):
        qhash = hashlib.sha256(query.strip().lower().encode()).hexdigest()
        now = time.time()
        with sqlite3.connect(CACHE_DB) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO search_cache (query_hash, query, response_json, cached_at) VALUES (?, ?, ?, ?)",
                (qhash, query, json.dumps(data), now)
            )
            conn.commit()
    
    async def search(self, query: str, num_results: int = 5) -> dict[str, Any]:
        """Perform search with cache check and fallback."""
        cached = self._get_from_cache(query)
        if cached:
            return cached
        
        if is_search_available():
            try:
                headers = {
                    "X-API-KEY": self.api_key,
                    "Content-Type": "application/json",
                }
                payload = {
                    "q": query,
                    "gl": "in",
                    "num": num_results,
                }
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(self.BASE_URL, headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        self._save_to_cache(query, data)
                        logger.info(f"Serper API query succeeded for: '{query}'")
                        return data
                    else:
                        logger.warning(f"Serper API error {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.warning(f"Serper search failed: {e}")
        
        # Fallback to local deterministic mock results
        mock_data = self._mock_search(query)
        return mock_data
    
    def _mock_search(self, query: str) -> dict:
        """Deterministic mock responses for Indian Railways search terms."""
        q_lower = query.lower()
        organic = []
        
        if "fog" in q_lower or "weather" in q_lower:
            organic.append({
                "title": "IMD Weather Warning: Dense Fog Advisory for Delhi-NCR, Western UP and Agra",
                "snippet": "India Meteorological Department (IMD) issues orange alert for North-Central plains. Visibility drops below 50m in Mathura and Agra sections. Northern Railway operates with modified fog signals.",
                "link": "https://mausam.imd.gov.in/advisory/fog-north-india",
                "date": "Today",
            })
        elif "derailment" in q_lower or "block" in q_lower or "track" in q_lower:
            organic.append({
                "title": "North Central Railway Notice: Emergency Track Tamping and Caution Orders",
                "snippet": "Engineering block authorized between Mathura Jn and Agra Cantt. Temporary single line working initiated. Crossovers restricted to 30 km/h.",
                "link": "https://ncr.indianrailways.gov.in/bulletins/traffic-regulation",
                "date": "Today",
            })
        else:
            organic.append({
                "title": "Indian Railways National Train Enquiry System (NTES) Live Status",
                "snippet": "Real-time updates on NDLS-BPL trunk corridor. Priority dispatching active for Vande Bharat and Rajdhani express trains.",
                "link": "https://enquiry.indianrail.gov.in",
                "date": "Today",
            })
        
        return {"organic": organic, "is_mock": True}
