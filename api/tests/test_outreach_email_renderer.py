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
    )

    assert "#0b1326" in html
    assert "#c0c1ff" in html
    assert "#060e20" in html
    assert "Scan complete" in html
    assert "TARGET_DOMAIN" in html
    assert "windup.es" in html
    assert "Informe de auditoría" in html
    assert "7 segundos" in html
    assert "Saludos" not in html
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
