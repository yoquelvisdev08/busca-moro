"""Orquestación de generación de pain points + cold email."""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from typing import Any, Optional

from closer.config import Settings
from closer.generator import prepare_prompt_variables
from closer.llm_client import LLMClient
from closer.prompts import (
    COLD_EMAIL_USER,
    PAIN_POINTS_SYSTEM,
    PAIN_POINTS_USER,
    SUPPLEMENT_SYSTEM,
    SUPPLEMENT_USER,
    segment_system_prompt,
)

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class GeneratedIntelligence:
    model: str
    language: str
    tone: str
    pain_points: list[dict[str, Any]]
    cold_email_subject: Optional[str]
    cold_email_body: Optional[str]
    extras: dict[str, Any]
    prompt_hash: str
    tokens_input: Optional[int]
    tokens_output: Optional[int]


class IntelligenceEngine:
    """Encapsula la lógica de generación con tolerancia a errores del modelo."""

    def __init__(self, llm: LLMClient, settings: Settings) -> None:
        self._llm = llm
        self._settings = settings

    async def generate(
        self,
        *,
        lead: dict[str, Any],
        audit: dict[str, Any],
        sender_profile: Optional[dict[str, Any]] = None,
    ) -> GeneratedIntelligence:
        # ------------------------------------------------------------------
        # Revenue loss estimation (Phase 1 — agency model)
        # ------------------------------------------------------------------
        rev_vars = prepare_prompt_variables(audit)

        pain_points_user = PAIN_POINTS_USER.format(
            max_pain_points=self._settings.max_pain_points,
            url=lead.get("url", ""),
            company=lead.get("company_name") or self._infer_company(lead),
            lighthouse_score=audit.get("lighthouse_score"),
            performance_score=audit.get("performance_score"),
            seo_score=audit.get("seo_score"),
            accessibility_score=audit.get("accessibility_score"),
            best_practices_score=audit.get("best_practices_score"),
            mobile_friendly=audit.get("mobile_friendly"),
            has_ssl=audit.get("has_ssl"),
            load_time_ms=audit.get("load_time_ms"),
            fcp_ms=audit.get("first_contentful_paint_ms"),
            lcp_ms=audit.get("largest_contentful_paint_ms"),
            cls=audit.get("cumulative_layout_shift"),
            tbt_ms=audit.get("total_blocking_time_ms"),
            tech_stack=self._compact_tech_stack(audit.get("detected_tech") or lead.get("tech_stack") or {}),
            revenue_loss_summary=rev_vars["revenue_loss_summary"],
            estimated_monthly_revenue=rev_vars["estimated_monthly_revenue"],
        )

        pain_response = await self._llm.chat(
            system=PAIN_POINTS_SYSTEM.format(language=self._settings.language),
            user=pain_points_user,
            json_response=True,
            temperature=0.4,
            max_tokens=self._settings.llm_max_tokens,
        )
        pain_payload = LLMClient.safe_json_loads(pain_response.content) or {}
        pain_points = self._normalize_pain_points(pain_payload.get("pain_points", []))

        segment = lead.get("segment") or "D"
        sp = sender_profile or {}
        system_prompt = segment_system_prompt(segment).format(
            tone=self._settings.tone,
            language=self._settings.language,
            sender_name=sp.get("name") or "Yoquelvis",
            sender_website=sp.get("website") or "https://yoquelvis.dev",
            revenue_loss_lead=rev_vars["revenue_loss_lead"],
            qualitative_impact=rev_vars["qualitative_impact"],
            disclaimer=rev_vars["disclaimer"],
        )
        email_user = COLD_EMAIL_USER.format(
            company=lead.get("company_name") or self._infer_company(lead),
            url=lead.get("url", ""),
            sender_name=sp.get("name") or "Yoquelvis",
            sender_title=sp.get("title") or "Desarrollador Web Full-Stack",
            sender_website=sp.get("website") or "https://yoquelvis.dev",
            sender_bio=sp.get("bio") or "",
            sender_services=self._compact_list(sp.get("services")),
            sender_tech_stack=self._compact_list(sp.get("tech_stack")),
            sender_signature=sp.get("email_signature") or "",
            pain_points=self._format_pain_points_for_prompt(pain_points),
            lighthouse_score=audit.get("lighthouse_score"),
            load_time_ms=audit.get("load_time_ms"),
            mobile_friendly=audit.get("mobile_friendly"),
            has_ssl=audit.get("has_ssl"),
        )
        email_response = await self._llm.chat(
            system=system_prompt,
            user=email_user,
            json_response=True,
            temperature=0.6,
            max_tokens=self._settings.llm_max_tokens,
        )
        email_payload = LLMClient.safe_json_loads(email_response.content) or {}

        subject = (email_payload.get("subject") or "").strip() or None
        body = (email_payload.get("body") or "").strip() or None

        # Append sender signature to body if provided and not already present
        signature = sp.get("email_signature", "")
        if signature and body and signature.strip() not in body:
            body = body.rstrip() + "\n\n" + signature.strip()

        supplement_user = SUPPLEMENT_USER.format(
            company=lead.get("company_name") or self._infer_company(lead),
            url=lead.get("url", ""),
            sender_name=sp.get("name") or "Consultor",
            sender_title=sp.get("title") or "",
            sender_bio=sp.get("bio") or "",
            sender_services=self._compact_list(sp.get("services")),
            pain_points=self._format_pain_points_for_prompt(pain_points),
            lighthouse_score=audit.get("lighthouse_score"),
            load_time_ms=audit.get("load_time_ms"),
            mobile_friendly=audit.get("mobile_friendly"),
            has_ssl=audit.get("has_ssl"),
            primary_subject=subject or "",
            primary_body_excerpt=(body or "")[:400],
        )
        supplement_response = await self._llm.chat(
            system=SUPPLEMENT_SYSTEM.format(language=self._settings.language),
            user=supplement_user,
            json_response=True,
            temperature=0.5,
            max_tokens=self._settings.llm_max_tokens,
        )
        supplement_payload = LLMClient.safe_json_loads(supplement_response.content) or {}
        extras: dict[str, Any] = {
            "sales_brief": str(supplement_payload.get("sales_brief", "")).strip(),
            "cold_email_subject_alt": str(
                supplement_payload.get("cold_email_subject_alt", "")
            ).strip()
            or None,
            "cold_email_body_alt": str(
                supplement_payload.get("cold_email_body_alt", "")
            ).strip()
            or None,
        }
        report_narrative = supplement_payload.get("report_narrative")
        if isinstance(report_narrative, dict):
            extras["report_narrative"] = report_narrative
        playbook = supplement_payload.get("commercial_playbook")
        if isinstance(playbook, dict):
            extras["commercial_playbook"] = playbook

        prompt_hash = hashlib.sha256(
            (pain_points_user + "||" + email_user + "||" + supplement_user).encode("utf-8")
        ).hexdigest()

        tokens_input = (
            (pain_response.prompt_tokens or 0)
            + (email_response.prompt_tokens or 0)
            + (supplement_response.prompt_tokens or 0)
        ) or None
        tokens_output = (
            (pain_response.completion_tokens or 0)
            + (email_response.completion_tokens or 0)
            + (supplement_response.completion_tokens or 0)
        ) or None

        return GeneratedIntelligence(
            model=self._settings.llm_model,
            language=self._settings.language,
            tone=self._settings.tone,
            pain_points=pain_points,
            cold_email_subject=subject,
            cold_email_body=body,
            extras=extras,
            prompt_hash=prompt_hash,
            tokens_input=tokens_input,
            tokens_output=tokens_output,
        )

    def _normalize_pain_points(self, raw: Any) -> list[dict[str, Any]]:
        if not isinstance(raw, list):
            return []
        cleaned: list[dict[str, Any]] = []
        for item in raw[: self._settings.max_pain_points]:
            if not isinstance(item, dict):
                continue
            cleaned.append(
                {
                    "title": str(item.get("title", "")).strip(),
                    "evidence": str(item.get("evidence", "")).strip(),
                    "business_impact": str(item.get("business_impact", "")).strip(),
                    "severity": str(item.get("severity", "medium")).strip().lower() or "medium",
                }
            )
        return cleaned

    @staticmethod
    def _format_pain_points_for_prompt(points: list[dict[str, Any]]) -> str:
        if not points:
            return "(sin pain points detectados)"
        lines: list[str] = []
        for i, p in enumerate(points, start=1):
            lines.append(
                f"{i}. {p.get('title')} ({p.get('severity')}). "
                f"Evidencia: {p.get('evidence')}. "
                f"Impacto: {p.get('business_impact')}."
            )
        return "\n".join(lines)

    @staticmethod
    def _compact_tech_stack(stack: dict[str, Any]) -> str:
        """Reduce el tech_stack a un string corto para no inflar el prompt.

        Mantener el prompt acotado abarata tokens y reduce latencia. Aplanamos
        a ``clave=valor`` y truncamos a 400 caracteres.
        """

        if not stack:
            return "(no detectado)"
        flat: list[str] = []
        for key, value in stack.items():
            if isinstance(value, (str, int, float, bool)):
                flat.append(f"{key}={value}")
            else:
                flat.append(f"{key}=present")
        text = ", ".join(flat)
        return text[:400]

    @staticmethod
    def _compact_list(items: Any) -> str:
        if not items:
            return "(no especificado)"
        if isinstance(items, list):
            return ", ".join(str(i) for i in items[:10])
        return str(items)

    @staticmethod
    def _infer_company(lead: dict[str, Any]) -> str:
        url = lead.get("url") or ""
        from urllib.parse import urlparse

        host = urlparse(url).hostname or url
        host = host.replace("www.", "")
        return host.split(".")[0].capitalize() if host else "su empresa"
