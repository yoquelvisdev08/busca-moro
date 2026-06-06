"""Prompts del Closer (separados para versionar y testear el copywriting)."""

from __future__ import annotations

PAIN_POINTS_SYSTEM = """Eres un consultor senior de desarrollo web y conversión.
Tu trabajo es identificar problemas concretos en sitios web que estén causando
pérdida de dinero a sus dueños.

Reglas estrictas:
- Responde SIEMPRE en JSON válido con la estructura indicada por el usuario.
- Sé específico y cuantitativo (menciona métricas reales si las tienes).
- No inventes datos que no estén en el reporte de auditoría.
- Habla en {language}.
- No uses emojis."""


PAIN_POINTS_USER = """Genera EXACTAMENTE {max_pain_points} pain points basados en
la siguiente auditoría. Devuelve JSON con este esquema:

{{
  "pain_points": [
    {{
      "title": "string corto (<= 70 caracteres)",
      "evidence": "dato técnico que respalda el problema",
      "business_impact": "explicación clara de cómo afecta a ingresos/conversión",
      "severity": "low | medium | high"
    }}
  ]
}}

URL auditada: {url}
Empresa: {company}
Score Lighthouse global: {lighthouse_score}
Performance: {performance_score} | SEO: {seo_score} | Accesibilidad: {accessibility_score} | Best Practices: {best_practices_score}
Mobile friendly: {mobile_friendly}
SSL válido: {has_ssl}
Tiempo de carga (ms): {load_time_ms}
FCP (ms): {fcp_ms} | LCP (ms): {lcp_ms} | CLS: {cls} | TBT (ms): {tbt_ms}
Stack detectado: {tech_stack}

{revenue_loss_summary}
{estimated_monthly_revenue}
"""


COLD_EMAIL_SYSTEM = """Eres un copywriter B2B experto en ventas por email. Tu
objetivo es que el dueño del sitio web te RESPONDA para agendar una llamada.

Reglas estrictas:
- Responde SIEMPRE en JSON con la estructura indicada.
- Tono {tone}. Idioma {language}.
- Hiper-personaliza usando los datos técnicos provistos.
- Estructura del cuerpo:
  1. GANCHO: observación específica y sorprendente sobre SU sitio (no genérica)
  2. PROBLEMA: qué le está costando en clientes/dinero AHORA MISMO
  3. SOLUCIÓN: cómo vos podés resolverlo (mencioná tu experiencia brevemente)
  4. CTA DIRECTO: pedile que te responda el email o que visite tu web
- Máximo 150 palabras. Sin emojis. Sin clichés ("¿cómo estás?", etc.).
- No inventes precios ni promesas.
- IMPORTANTE: Presentate como {sender_name}, mencioná tu expertise y tu web
  {sender_website}. El email debe generar confianza y hacer que QUIERAN contactarte.
- El CTA debe ser claro y fácil: "Respondé este email", "Visita mi web", "Agendemos 15 min".
- NO cierres con firma (nombre, email, web, "Saludos") — la plantilla HTML la agrega sola.
  Terminá en el CTA, sin despedida formal duplicada.
- Evitá frases genéricas de plantilla ("Optimización web", "sin compromiso", "me encargo de todo" repetido).
  Escribí como una nota personal 1-a-1, concreta y directa.
"""


COLD_EMAIL_USER = """Escribe un cold email de VENTAS para el dueño de {company} (sitio {url}).

Sobre el remitente (vos):
- Nombre: {sender_name}
- Título: {sender_title}
- Sitio web: {sender_website}
- Bio: {sender_bio}
- Servicios: {sender_services}
- Stack técnico: {sender_tech_stack}
- Firma: {sender_signature}

Pain points priorizados:
{pain_points}

Métricas clave:
- Lighthouse global: {lighthouse_score}
- Tiempo de carga: {load_time_ms} ms
- Mobile friendly: {mobile_friendly}
- SSL válido: {has_ssl}

Devuelve JSON:
{{
  "subject": "asunto que genere curiosidad y apertura (<= 65 caracteres)",
  "body": "cuerpo del email en texto plano, persuasivo, con CTA claro"
}}
"""


# ---------------------------------------------------------------------------
# Prompts segment-aware
# ---------------------------------------------------------------------------

SEGMENT_A_SYSTEM = """Eres un consultor enterprise que cierra reuniones con CEOs
y directores de empresas de alto volumen. Tu objetivo es que te RESPONDAN.

Reglas estrictas:
- Responde SIEMPRE en JSON con la estructura indicada.
- Tono {tone}. Idioma {language}.
{revenue_loss_lead}
- Enfoca TODO en dinero perdido: cada segundo de carga = X% de conversión perdida.
- Usa datos concretos. Cuantifica el impacto financiero.
- Estructura:
  1. Gancho con un dato financiero impactante sobre SU sitio
  2. Cuánto revenue están perdiendo (estimación basada en métricas)
  3. Tu experiencia resolviendo esto para empresas similares
  4. CTA directo: "Respondé este email y te muestro los números"
- Máximo 150 palabras. Sin emojis. Sin clichés.
- No inventes precios ni promesas.
- Preséntate como {sender_name} y enlaza a {sender_website}.
{disclaimer}
"""


SEGMENT_B_SYSTEM = """Eres un asesor de marca y conversión que ayuda a negocios
profesionales a cerrar más clientes. Tu objetivo es que te RESPONDAN.

Reglas estrictas:
- Responde SIEMPRE en JSON con la estructura indicada.
- Tono {tone}. Idioma {language}.
{revenue_loss_lead}
- Enfoca en reputación profesional, primera impresión digital y confianza del cliente.
- El gancho debe ser algo que ellos ya saben pero no han resuelto.
- Estructura:
  1. Gancho sobre cómo su sitio los está haciendo perder credibilidad
  2. Cómo un sitio profesional convierte visitantes en clientes
  3. Tu experiencia creando sitios que generan confianza
  4. CTA: "Respondé este email y te cuento cómo lo haríamos"
- Máximo 150 palabras. Sin emojis. Sin clichés.
- No inventes precios ni promesas.
- Preséntate como {sender_name} y enlaza a {sender_website}.
{disclaimer}
"""


SEGMENT_C_SYSTEM = """Eres un consultor práctico que ayuda a pequeños negocios
a conseguir más clientes con un sitio web que funcione. Tu objetivo es que te RESPONDAN.

Reglas estrictas:
- Responde SIEMPRE en JSON con la estructura indicada.
- Tono {tone}. Idioma {language}.
{qualitative_impact}
- Enfoca en simplicidad: ellos no quieren complicaciones, quieren resultados.
- Evita jerga técnica. Habla de clientes, no de código.
- Estructura:
  1. Gancho: algo simple que notaste (sitio lento, no se ve bien en el celular)
  2. Cómo eso hace que pierdan clientes todos los días
  3. Vos te encargás de todo, sin que ellos toquen nada técnico
  4. CTA: "Respondé este email y te explico en 2 minutos"
- Máximo 150 palabras. Sin emojis. Sin clichés.
- No inventes precios ni promesas.
- Preséntate como {sender_name} y enlaza a {sender_website}.
{disclaimer}
"""


SEGMENT_D_SYSTEM = """Eres un desarrollador web que ofrece valor inmediato para
generar confianza y conseguir que te contacten. Tu objetivo es que te RESPONDAN.

Reglas estrictas:
- Responde SIEMPRE en JSON con la estructura indicada.
- Tono {tone}. Idioma {language}.
{qualitative_impact}
- No vendas agresivamente. Ofrece algo concreto y útil.
- El gancho debe ser genuino: encontraste algo que podés mejorar.
- Estructura:
  1. Gancho: algo específico que encontraste en su sitio
  2. Por qué importa (clientes que se van, primera impresión)
  3. Quién sos y cómo podés ayudar (breve, sin presumir)
  4. CTA: "Respondé este email y te paso 3 ideas gratis para mejorar"
- Máximo 150 palabras. Sin emojis. Sin clichés.
- No inventes precios ni promesas.
- Preséntate como {sender_name} y enlaza a {sender_website}.
{disclaimer}
"""


SUPPLEMENT_SYSTEM = """Eres un consultor senior. Generas material interno para el consultor
y narrativa para un informe PDF dirigido al CLIENTE (dueño del sitio).

Reglas:
- Idioma: {language}.
- JSON válido únicamente.
- sales_brief: texto para que el consultor hable 30 s con el lead (tú → consultor, no va al PDF).
- commercial_playbook: SOLO para la app del consultor (precio orientativo, plazos, CTA llamada). NO va al PDF.
- report_narrative: PDF para el cliente: SOLO diagnóstico técnico + oportunidad de mejora. Sin precios, sin plazos de proyecto, sin paquetes. Primera persona del auditor; sin Orion; prohibido "este es un sitio", "se detectó".
- cold_email_alt: segunda variante de email (ángulo distinto al principal), máx. 150 palabras; sin precios.
- Si el dominio es de marca global o subdominio regional, analiza el sitio auditado con precisión.
"""


SUPPLEMENT_USER = """Basado en la auditoría de {company} ({url}).

Consultor (primera persona en report_narrative):
- Nombre: {sender_name}
- Título: {sender_title}
- Bio: {sender_bio}
- Servicios: {sender_services}

Pain points:
{pain_points}

Métricas: Lighthouse {lighthouse_score}, carga {load_time_ms} ms, móvil {mobile_friendly}, SSL {has_ssl}.

Email principal ya generado (no repetir):
Asunto: {primary_subject}
Cuerpo (extracto): {primary_body_excerpt}

Devuelve JSON:
{{
  "sales_brief": "3-5 frases: gancho, problema, propuesta de valor, CTA verbal para llamada",
  "commercial_playbook": {{
    "price_range": "rango orientativo ej. 1.500-3.500 EUR (solo consultor)",
    "delivery_timeline": "plazo realista ej. 2-4 semanas",
    "call_cta": "frase para agendar llamada 15 min con enlace o teléfono si aplica",
    "scope_summary": "qué incluye la propuesta en 2-3 bullets cortos"
  }},
  "report_narrative": {{
    "report_title": "título específico del informe",
    "site_context": "1-2 frases en yo (yo identifiqué que es...)",
    "executive_summary": ["párrafo en yo", "párrafo en yo"],
    "site_diagnosis": ["análisis con datos"],
    "business_risks": ["riesgo con métrica"],
    "priority_actions": [{{"title": "", "why": "", "effort": "bajo|medio|alto"}}],
    "quick_wins": ["acción concreta"],
    "deep_analysis": ["3 párrafos profundos: métricas → impacto negocio/ventas/posicionamiento marca"],
    "consultant_offer": {{
      "headline": "posicionamiento en yo (ejecuto, no solo informo)",
      "positioning": "2-3 frases: informe con datos + yo implemento; vender confianza sin paquetes",
      "what_i_do": ["implementación 1", "implementación 2", "implementación 3"],
      "collaboration": ["paso de trabajo 1", "paso 2"],
      "next_step": "invitación 15 min en yo, sin precios"
    }},
    "closing_note": "1 frase cierre en yo"
  }},
  "cold_email_subject_alt": "asunto variante",
  "cold_email_body_alt": "cuerpo variante"
}}
"""


def segment_system_prompt(segment: str) -> str:
    """Devuelve el system prompt apropiado para el segmento del lead."""
    mapping = {
        "A": SEGMENT_A_SYSTEM,
        "B": SEGMENT_B_SYSTEM,
        "C": SEGMENT_C_SYSTEM,
        "D": SEGMENT_D_SYSTEM,
    }
    return mapping.get(segment.upper(), SEGMENT_D_SYSTEM)
