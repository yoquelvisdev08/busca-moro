"""Tests for outreach HTML email renderer."""

from app.services.outreach_email_renderer import render_outreach_email_html


def test_orion_stitch_dark_layout():
    consultant = {
        "name": "Yoquelvis",
        "title": "Desarrollo web y optimización",
        "company": "Yoquelvis",
        "website": "https://yoquelvis.dev",
        "email": "outreach@yoquelvis.dev",
    }
    body = (
        "Hola,\n\n"
        "Noté que windup.es tarda más de 7 segundos en cargar.\n\n"
        "Respondé este email y te explico en 2 minutos cómo lo logramos.\n\n"
        "Saludos, Yoquelvis Desarrollador Web Full-Stack"
    )

    html = render_outreach_email_html(
        body_text=body,
        consultant=consultant,
        brand={"tagline": "Optimización web"},
        has_report_attachment=True,
        lead_domain="windup.es",
        subject="Velocidad en windup.es",
        audit_metrics={"load_time": "7.2s", "performance_score": 42},
        pain_points=[
            {
                "title": "Carga lenta",
                "business_impact": "Pierdes visitantes en los primeros segundos.",
                "severity": "high",
            }
        ],
    )

    assert "#0b1326" in html
    assert "#c0c1ff" in html
    assert "#060e20" in html
    assert "Scan complete" in html
    assert "TARGET_DOMAIN" in html
    assert "windup.es" in html
    assert "Informe de auditoría" in html
    assert "7 segundos" in html
    assert "Hallazgos principales" in html
    assert "Carga lenta" in html
    assert "7.2s" in html
    assert "Saludos" not in html
    assert "Responder a Yoquelvis" not in html


def test_single_paragraph_with_sender_website_is_not_stripped():
    consultant = {
        "name": "Yoquelvis",
        "title": "Desarrollo web y optimización",
        "website": "https://yoquelvis.dev",
        "email": "outreach@yoquelvis.dev",
    }
    body = (
        "Hola, soy Yoquelvis, desarrollador web (https://yoquelvis.dev). "
        "Noté que tu sitio tiene un problema: los elementos se mueven al cargar. "
        "Respondé este email y te explico en 2 minutos cómo solucionarlo."
    )

    html = render_outreach_email_html(
        body_text=body,
        consultant=consultant,
        brand={"tagline": "Optimización web"},
        lead_domain="ambarisestetica.com",
        subject="Test",
    )

    assert "elementos se mueven" in html
    assert "Hola," in html
    assert "Responder a Yoquelvis" not in html


def test_shows_cta_when_body_has_none():
    html = render_outreach_email_html(
        body_text="Hola,\n\nTexto sin llamada a la acción.",
        consultant={
            "name": "Ana",
            "title": "Consultora",
            "company": "Ana Studio",
            "website": "https://ana.dev",
            "email": "ana@ana.dev",
        },
        brand={"tagline": "Consultoría digital"},
        subject="Hola",
    )
    assert "Responder a Ana" in html


def test_fallback_body_when_content_is_only_signature():
    html = render_outreach_email_html(
        body_text="Yoquelvis\nDesarrollo web y optimización\nyoquelvis.dev",
        consultant={
            "name": "Yoquelvis",
            "title": "Desarrollo web y optimización",
            "website": "https://yoquelvis.dev",
            "email": "outreach@yoquelvis.dev",
        },
        brand={"tagline": "Optimización web"},
        lead_domain="ambarisestetica.com",
        audit_metrics={"load_time": "2.1s", "cls": "0.127"},
        pain_points=[
            {
                "title": "Layout inestable",
                "business_impact": "Los elementos se mueven al cargar.",
                "severity": "high",
            }
        ],
    )

    assert "Revisé ambarisestetica.com" in html
    assert "Layout inestable" in html
    assert "2.1s" in html
