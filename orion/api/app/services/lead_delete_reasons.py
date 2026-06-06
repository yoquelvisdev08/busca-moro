"""Motivos estándar al archivar/eliminar un lead."""

from __future__ import annotations

REASON_CODES: dict[str, str] = {
    "no_email": "Sin email para contactar",
    "no_phone": "Sin teléfono ni canal de contacto claro",
    "not_contactable": "No es contactable (datos incompletos)",
    "no_fit": "No encaja con mi ICP / servicio",
    "duplicate": "Lead duplicado",
    "big_brand": "Marca grande / sitio corporativo no prospectable",
    "bad_domain": "Dominio inválido, caído o sin sitio útil",
    "low_quality": "Calidad baja / sin señal comercial",
    "already_contacted": "Ya contactado o descartado antes",
    "other": "Otro motivo",
}


def format_deleted_reason(code: str, detail: str | None = None) -> str:
    label = REASON_CODES.get(code.strip(), code.strip())
    extra = (detail or "").strip()
    if not extra:
        return label
    if code == "other":
        return extra
    return f"{label} — {extra}"
