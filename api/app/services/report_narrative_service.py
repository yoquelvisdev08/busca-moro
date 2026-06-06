"""Genera narrativa del informe PDF con IA (análisis profundo, orientado al cliente)."""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.services.llm_client import LLMClient

logger = logging.getLogger(__name__)

_REPORT_SYSTEM = """Eres el consultor que ejecutó la auditoría. Redactas el informe en PRIMERA PERSONA (yo revisé, encontré, medí).
El lector es el dueño del negocio (no un desarrollador).

Reglas:
- Idioma: español neutro profesional.
- Analiza el dominio y las métricas: infiere qué tipo de negocio parece ser el sitio.
- Si el dominio es de marca global o subdominio regional (ej. pt.venngage.com),
  habla del sitio concreto auditado, no inventes que es un negocio local pequeño.
- NO menciones herramientas internas (Orion, Redis, Docker).
- NO pongas precios ni paquetes cerrados.
- NO uses frases vacías sin datos.
- Evita títulos genéricos; el report_title debe nombrar el sitio o la marca auditada.
- Toda la narrativa en primera persona del auditor. PROHIBIDO: "este es un sitio", "se detectó", tercera persona impersonal.
- En la sección final (consultant_offer): posicionarte como quien EJECUTA las mejoras, no solo las lista.
  Ideología: el informe demuestra el problema con datos; tú vendes confianza y ejecución ("yo me encargo").
  Sin tono agresivo ni paquetes; invitación clara a una conversación.
- Responde SOLO JSON válido con el esquema indicado."""


def _build_user_prompt(ctx: dict[str, Any]) -> str:
    lead = ctx.get("lead") or {}
    audit = ctx.get("audit") or {}
    pain_points = ctx.get("pain_points") or []
    consultant = ctx.get("consultant") or {}
    pp_text = "\n".join(
        f"- {p.get('title')}: {p.get('description') or p.get('business_impact', '')} "
        f"(evidencia: {p.get('evidence', 'n/a')})"
        for p in pain_points[:8]
    )
    auditor_name = consultant.get("name") or "el consultor"
    auditor_title = consultant.get("title") or ""
    services = ", ".join(consultant.get("services") or []) or "rendimiento web, UX, conversión"
    bio = consultant.get("bio") or ""

    return f"""Genera el contenido del informe. Tú eres {auditor_name}{f" ({auditor_title})" if auditor_title else ""} y hablas en primera persona.

TU PERFIL (úsalo en la sección final):
- Bio: {bio or "consultor full-stack enfocado en rendimiento y conversión"}
- Servicios: {services}
- Email: {consultant.get("email") or ""}
- Web: {consultant.get("website") or ""}

DOMINIO / EMPRESA:
- URL: {lead.get('url')}
- Dominio: {lead.get('domain')}
- Nombre: {lead.get('company_name')}
- Industria: {lead.get('industry')}
- Segmento: {lead.get('segment')}

MÉTRICAS:
- Lighthouse: {audit.get('lighthouse_score')} | Performance: {audit.get('performance_score')}
- SEO: {audit.get('seo_score')} | Carga: {audit.get('load_time_display')}
- Móvil: {audit.get('mobile_friendly')} | SSL: {audit.get('has_ssl')}
- LCP: {audit.get('lcp_ms')} ms | CLS: {audit.get('cls')}

HALLAZGOS:
{pp_text or '(generar desde métricas)'}

JSON requerido:
{{
  "report_title": "título específico con marca/sitio",
  "site_context": "1-2 frases en yo",
  "executive_summary": ["párrafo en yo", "párrafo en yo"],
  "site_diagnosis": ["análisis en yo con datos"],
  "deep_analysis": [
    "párrafo profundo: relación métricas → negocio/ventas/posicionamiento de SU marca",
    "párrafo profundo: qué pierden hoy en confianza, SEO o conversión con números",
    "párrafo profundo: oportunidad si corrigen (sin prometer milagros)"
  ],
  "business_risks": ["riesgo con métrica"],
  "priority_actions": [{{"title": "", "why": "", "effort": "bajo|medio|alto"}}],
  "quick_wins": ["acción semana 1"],
  "consultant_offer": {{
    "headline": "frase corta de posicionamiento (yo + valor único)",
    "positioning": "2-3 frases: por qué un informe no basta, hace falta quien ejecute; yo me diferencio porque...",
    "what_i_do": ["cómo yo implemento mejora 1", "mejora 2", "mejora 3"],
    "collaboration": ["cómo trabajaríamos juntos paso 1", "paso 2"],
    "next_step": "1-2 frases en yo invitando a hablar 15 min, sin precios"
  }},
  "closing_note": "1 frase cierre en yo"
}}"""


def _default_consultant_offer(ctx: dict[str, Any]) -> dict[str, Any]:
    consultant = ctx.get("consultant") or {}
    lead = ctx.get("lead") or {}
    domain = lead.get("domain") or "tu sitio"
    name = consultant.get("name") or "Yo"
    email = consultant.get("email") or ""
    website = consultant.get("website") or ""
    services = consultant.get("services") or [
        "Auditoría y corrección de rendimiento",
        "Experiencia móvil y conversión",
        "SEO técnico y Core Web Vitals",
    ]

    return {
        "headline": f"Puedo ejecutar estas mejoras en {domain} — no solo documentarlas",
        "positioning": (
            f"Este informe demuestra con datos dónde {domain} pierde velocidad, confianza y oportunidades. "
            f"Muchos equipos se quedan en el PDF; yo, {name}, trabajo en la ejecución: priorizo, implemento "
            f"y dejo el sitio listo para vender y posicionar mejor la marca."
        ),
        "what_i_do": services[:5]
        if services
        else [
            "Corregir causas de carga lenta y métricas Lighthouse",
            "Ajustar móvil, SSL y recorrido de conversión",
            "Acompañarte con informes antes/después medibles",
        ],
        "collaboration": [
            "Revisamos juntos este informe y priorizamos por impacto en negocio",
            "Yo implemento los cambios técnicos acordados",
            "Validamos resultados con nueva auditoría y analítica",
        ],
        "next_step": (
            f"Si te encaja, escríbeme a {email} y agendamos 15 minutos para definir el plan. "
            "Sin compromiso en esa llamada."
            if email
            else (
                f"Si te encaja, escríbeme o visita {website} y agendamos 15 minutos para definir el plan. "
                "Sin compromiso en esa llamada."
                if website
                else "Si te encaja, respóndeme y agendamos 15 minutos para definir el plan."
            )
        ),
    }


def _fallback_narrative(ctx: dict[str, Any]) -> dict[str, Any]:
    lead = ctx.get("lead") or {}
    domain = lead.get("domain") or "el sitio"
    company = lead.get("company_name") or domain
    audit = ctx.get("audit") or {}
    lh = audit.get("lighthouse_score")
    load = audit.get("load_time_display") or "N/A"
    consultant = ctx.get("consultant") or {}
    name = consultant.get("name") or "Yo"

    return {
        "report_title": f"Diagnóstico digital — {company}",
        "site_context": f"Revisé {domain} y documenté su rendimiento y oportunidades de mejora.",
        "executive_summary": [
            f"Audité {domain} con Lighthouse y Core Web Vitals.",
            f"Medí Lighthouse {lh if lh is not None else 'N/D'}/100 y carga {load}.",
            "Abajo profundizo el impacto en negocio y cómo puedo ayudarte a ejecutar las mejoras.",
        ],
        "site_diagnosis": [
            "En la primera carga la velocidad y la estabilidad visual definen si el visitante confía o abandona.",
            "Verifiqué móvil y HTTPS: son la base para convertir y para posicionar la marca en buscadores.",
        ],
        "deep_analysis": [
            f"Con Lighthouse {lh if lh is not None else 'N/D'}/100 y {load} de carga, {domain} está dejando rendimiento sobre la mesa: cada fricción resta consultas y refuerza la percepción de una marca menos cuidada.",
            "En negocios que compiten por atención online, el sitio es escaparate y canal de venta; si tarda o falla en móvil, pagáis la adquisición y perdéis la conversión en silencio.",
            f"La oportunidad es alinear técnica y negocio: un sitio rápido y claro no solo rankea mejor — transmite que {company} está al día y merece la confianza del cliente.",
        ],
        "business_risks": [
            "Abandono temprano si la página tarda en mostrar valor.",
            "Menor visibilidad orgánica con SEO técnico y rendimiento por debajo del estándar.",
        ],
        "priority_actions": [
            {"title": "Mejorar tiempo de carga", "why": f"Carga actual {load}", "effort": "medio"},
            {"title": "Corregir móvil y SSL", "why": "Confianza y conversión", "effort": "medio"},
        ],
        "quick_wins": [
            "Comprimir imágenes críticas de la home",
            "Revisar HTTPS y redirecciones en todo el dominio",
        ],
        "consultant_offer": _default_consultant_offer(ctx),
        "closing_note": f"{name}: estoy disponible para convertir este diagnóstico en un plan de trabajo concreto.",
    }


def _enrich_narrative(narrative: dict[str, Any], ctx: dict[str, Any]) -> dict[str, Any]:
    """Completa campos nuevos si el narrative viene de intel antigua."""
    fallback = _fallback_narrative(ctx)
    if not narrative.get("deep_analysis"):
        narrative["deep_analysis"] = fallback["deep_analysis"]
    offer = narrative.get("consultant_offer")
    if not isinstance(offer, dict) or not offer.get("headline"):
        narrative["consultant_offer"] = fallback["consultant_offer"]
    else:
        default_offer = _default_consultant_offer(ctx)
        for key in ("headline", "positioning", "what_i_do", "collaboration", "next_step"):
            if not offer.get(key):
                offer[key] = default_offer.get(key)
    if not narrative.get("closing_note"):
        narrative["closing_note"] = fallback["closing_note"]
    return narrative


async def generate_report_narrative(ctx: dict[str, Any]) -> dict[str, Any]:
    """Devuelve narrativa para plantilla PDF. Usa fallback si no hay LLM."""
    existing = (ctx.get("intel_extras") or {}).get("report_narrative")
    if isinstance(existing, dict) and existing.get("executive_summary"):
        return _enrich_narrative(existing, ctx)

    llm = LLMClient()
    payload = await llm.chat_json(
        system=_REPORT_SYSTEM,
        user=_build_user_prompt(ctx),
        temperature=0.45,
        max_tokens=3600,
    )
    if not payload:
        return _fallback_narrative(ctx)

    fallback = _fallback_narrative(ctx)
    for key in (
        "executive_summary",
        "site_diagnosis",
        "deep_analysis",
        "business_risks",
        "priority_actions",
        "quick_wins",
    ):
        if key not in payload or not isinstance(payload[key], list):
            payload[key] = fallback.get(key, [])

    if not isinstance(payload.get("consultant_offer"), dict):
        payload["consultant_offer"] = fallback["consultant_offer"]

    for field in ("report_title", "site_context", "closing_note"):
        if not payload.get(field):
            payload[field] = fallback.get(field)

    return _enrich_narrative(payload, ctx)
