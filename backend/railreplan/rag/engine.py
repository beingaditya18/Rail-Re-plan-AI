"""
RAG Engine for RailReplan.
Combines local rulebook knowledge base (G&SR, HOER, Fog SOP, Platform rules)
with live Serper web search evidence to support the Copilot and decision explanations.
"""
from __future__ import annotations

import logging
import math
import re
from pathlib import Path
from typing import Any, Optional

from railreplan.models import EvidenceClaim, EvidenceBundle
from railreplan.rag.search import SerperClient

logger = logging.getLogger(__name__)

KB_DIR = Path(__file__).resolve().parent / "kb"


class DocumentChunk:
    def __init__(self, doc_id: str, title: str, section: str, text: str):
        self.doc_id = doc_id
        self.title = title
        self.section = section
        self.text = text
        self.tokens = self._tokenize(text)
    
    @staticmethod
    def _tokenize(text: str) -> list[str]:
        return re.findall(r'\b[a-zA-Z0-9_\-]{2,}\b', text.lower())


class RAGEngine:
    """Retrieval-Augmented Generation Engine with local rulebooks + web search."""
    
    def __init__(self):
        self.chunks: list[DocumentChunk] = []
        self.serper = SerperClient()
        self._load_knowledge_base()
    
    def _load_knowledge_base(self):
        """Parse all markdown files in the KB directory into section chunks."""
        if not KB_DIR.exists():
            logger.warning(f"KB dir {KB_DIR} does not exist.")
            return
        
        for file_path in KB_DIR.glob("*.md"):
            doc_id = file_path.stem
            try:
                content = file_path.read_text(encoding="utf-8")
                lines = content.splitlines()
                title = lines[0].replace("#", "").strip() if lines else doc_id
                
                # Split by headers (## )
                current_section = "General"
                current_lines: list[str] = []
                
                for line in lines[1:]:
                    if line.startswith("## "):
                        if current_lines:
                            chunk_text = "\n".join(current_lines).strip()
                            if chunk_text:
                                self.chunks.append(DocumentChunk(doc_id, title, current_section, chunk_text))
                            current_lines = []
                        current_section = line.replace("## ", "").strip()
                    else:
                        current_lines.append(line)
                
                if current_lines:
                    chunk_text = "\n".join(current_lines).strip()
                    if chunk_text:
                        self.chunks.append(DocumentChunk(doc_id, title, current_section, chunk_text))
                        
            except Exception as e:
                logger.error(f"Error loading KB file {file_path}: {e}")
        
        logger.info(f"Loaded {len(self.chunks)} knowledge base chunks from {KB_DIR}")
    
    def retrieve(self, query: str, top_k: int = 3) -> list[EvidenceClaim]:
        """BM25-style keyword search over local rulebook chunks."""
        query_tokens = DocumentChunk._tokenize(query)
        if not query_tokens or not self.chunks:
            return []
        
        scores: list[tuple[float, DocumentChunk]] = []
        
        # Calculate IDF-weighted overlap
        N = len(self.chunks)
        for chunk in self.chunks:
            score = 0.0
            for qt in set(query_tokens):
                # Document frequency
                df = sum(1 for c in self.chunks if qt in c.tokens)
                if df == 0:
                    continue
                idf = math.log((N - df + 0.5) / (df + 0.5) + 1.0)
                tf = chunk.tokens.count(qt)
                # BM25 tf normalization
                k1 = 1.5
                b = 0.75
                avg_dl = sum(len(c.tokens) for c in self.chunks) / N
                dl = len(chunk.tokens)
                norm_tf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avg_dl)))
                score += idf * norm_tf
            
            # Boost if section title matches query terms
            section_tokens = DocumentChunk._tokenize(chunk.section)
            if any(qt in section_tokens for qt in query_tokens):
                score *= 1.4
            
            if score > 0:
                scores.append((score, chunk))
        
        scores.sort(key=lambda x: x[0], reverse=True)
        top_results = scores[:top_k]
        
        claims: list[EvidenceClaim] = []
        for score, chunk in top_results:
            claims.append(EvidenceClaim(
                claim=f"{chunk.title} — {chunk.section}",
                source_title=chunk.title,
                source_url=f"kb://{chunk.doc_id}",
                source_date="Current Rulebook",
                excerpt=chunk.text[:300] + ("..." if len(chunk.text) > 300 else ""),
                confidence=min(0.98, 0.6 + score * 0.05),
                source_type="rulebook",
            ))
        
        return claims
    
    async def get_evidence_bundle(self, query: str, include_web: bool = False) -> EvidenceBundle:
        """Create a complete evidence bundle with local rulebooks and optional web search."""
        claims = self.retrieve(query, top_k=3)
        
        if include_web or "weather" in query.lower() or "news" in query.lower() or "imd" in query.lower():
            web_results = await self.serper.search(query, num_results=2)
            organic = web_results.get("organic", [])
            for res in organic:
                claims.append(EvidenceClaim(
                    claim=res.get("title", "Web Intelligence"),
                    source_title=res.get("title", "Live Search"),
                    source_url=res.get("link", ""),
                    source_date=res.get("date", "Today"),
                    excerpt=res.get("snippet", "")[:300],
                    confidence=0.85,
                    source_type="web",
                ))
        
        return EvidenceBundle(
            query=query,
            claims=claims,
            grounded=len(claims) > 0,
        )
