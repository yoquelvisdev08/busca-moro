"""Scoring de intención por keywords + LLM."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Optional

from poseidon.language import looks_spanish
from poseidon.llm_client import LLMClient
from poseidon.pullpush_client import is_supply_side_title
from poseidon.searx_client import SearchHit

logger = logging.getLogger(__name__)

_INTENT_PATTERNS: list[tuple[str, str, int]] = [
    (r"^\[hiring\]", "web_dev", 46),
    (r"^\[task\]", "web_dev", 44),
    (r"necesito ayuda.*web|ayuda con mi (pagina|página|sitio)", "web_dev", 35),
    (r"busco desarrollador|busco programador|busco freelancer", "web_dev", 30),
    (r"need help.*(website|web|wordpress)|help with my (website|site)", "web_dev", 34),
    (r"looking for (a )?(web )?developer|looking for freelancer", "web_dev", 32),
    (r"necesito (una )?pagina web|necesito (un )?sitio web|hacer mi web", "web_dev", 32),
    (r"wordpress.*(roto|error|lento|ayuda|arreglar|help|fix|slow)", "wordpress", 34),
    (r"scraping|scrapear|raspado|extraer datos|bot de datos", "scraping", 36),
    (r"lento|velocidad|lighthouse|core web vitals|optimizar|slow|speed", "performance", 28),
    (r"hosting|dominio|ssl|certificado|servidor ca[ií]do|hosting down", "hosting", 26),
    (r"cotizaci[oó]n|presupuesto|cuanto cuesta|precio.*web|quote", "web_dev", 24),
    (r"no funciona|no carga|error 500|pantalla blanca|broken|fix my site", "web_dev", 22),
    (r"freelance|proyecto web|remoto|urgente|rebuild.*site", "web_dev", 18),
]

_NOISE_PATTERNS = (
    r"curso de|tutorial|aprender a programar|oferta de trabajo empresa",
    r"we are hiring|vacante|contratamos",
    r"vendo|compro dominio",
    r"^\[for hire\]",
    r"^\[offer\]",
)


@dataclass
class IntentVerdict:
    keyword_score: int
    intent_score: int
    intent_category: str
    llm_score: Optional[int]
    llm_summary: Optional[str]
    reply_angle: Optional[str]
    accepted: bool


def keyword_score(hit: SearchHit) -> tuple[int, str]:
    if is_supply_side_title(hit.title):
        return 0, "general"

    text = f"{hit.title} {hit.snippet} {hit.query}".lower()
    for pattern in _NOISE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return 0, "general"

    best_score = 0
    category = "general"
    for pattern, cat, points in _INTENT_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            if points > best_score:
                best_score = points
                category = cat
    return min(best_score, 100), category


async def classify_hit(
    hit: SearchHit,
    *,
    llm: Optional[LLMClient],
    min_keyword: int,
    min_intent: int,
    min_intent_no_llm: int = 32,
    require_spanish: bool = True,
) -> IntentVerdict:
    if require_spanish and not looks_spanish(f"{hit.title} {hit.snippet} {hit.query}"):
        return IntentVerdict(0, 0, "general", None, None, None, False)

    kw_score, category = keyword_score(hit)
    if kw_score < min_keyword:
        return IntentVerdict(kw_score, kw_score, category, None, None, None, False)

    llm_score: Optional[int] = None
    summary: Optional[str] = None
    angle: Optional[str] = None
    final_score = kw_score
    llm_used_successfully = False

    if llm is not None:
        try:
            llm_result = await llm.classify_post(
                title=hit.title,
                snippet=hit.snippet,
                url=hit.url,
                query=hit.query,
            )
            if llm_result:
                llm_used_successfully = True
                llm_score = int(llm_result.get("confidence") or 0)
                if llm_result.get("is_real_request") is False:
                    return IntentVerdict(kw_score, 0, category, llm_score, None, None, False)
                category = str(llm_result.get("intent_category") or category)
                summary = str(llm_result.get("summary") or "").strip() or None
                angle = str(llm_result.get("reply_angle") or "").strip() or None
                final_score = min(100, int((kw_score * 0.45) + (llm_score * 0.55)))
        except Exception as exc:
            logger.warning("poseidon_llm_failed url=%s err=%s", hit.url, exc)

    if llm_used_successfully:
        accepted = final_score >= min_intent
    else:
        final_score = kw_score
        accepted = kw_score >= min_intent_no_llm

    return IntentVerdict(
        keyword_score=kw_score,
        intent_score=final_score,
        intent_category=category,
        llm_score=llm_score,
        llm_summary=summary,
        reply_angle=angle,
        accepted=accepted,
    )
