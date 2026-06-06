"""Detección de contenido en español para Poseidon."""

from __future__ import annotations

import re

_SPANISH_MARKERS = re.compile(
    r"[ñáéíóúü]|¿|¡|"
    r"\b(necesito|busco|ayuda|pagina|página|sitio|desarrollador|programador|"
    r"wordpress|cotizaci|presupuesto|español|espanol|latam|mexico|méxico|"
    r"argentina|colombia|chile|peru|perú|venezuela|uruguay|ecuador|"
    r"dominicana|hola|gracias|urgente|freelance|proyecto|web|hosting|"
    r"dominio|ssl|lento|arreglar|error|roto|caido|caído)\b",
    re.IGNORECASE,
)

_SPANISH_SUBREDDIT = re.compile(
    r"\b(spain|es|latam|mexico|argentina|colombia|chile|peru|venezuela|"
    r"uruguay|ecuador|republica|dominicana|espanol|español)\b",
    re.IGNORECASE,
)

_ENGLISH_LEAD = re.compile(
    r"\b(need help|looking for|for hire|hire me|anyone know|please help|"
    r"how do i|my website|wordpress site|i need a|seeking|wanted)\b",
    re.IGNORECASE,
)


def looks_spanish(text: str) -> bool:
    """True si el post parece útil para contacto en español."""
    sample = (text or "").strip()
    if not sample:
        return False
    if _SPANISH_MARKERS.search(sample):
        return True
    if _SPANISH_SUBREDDIT.search(sample):
        return True
    if _ENGLISH_LEAD.search(sample) and not _SPANISH_MARKERS.search(sample):
        return False
    return False
