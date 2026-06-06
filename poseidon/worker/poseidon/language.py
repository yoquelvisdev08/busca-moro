"""Detección de contenido en español / LATAM para Poseidon."""

from __future__ import annotations

import re

_SPANISH_MARKERS = re.compile(
    r"[ñáéíóúü]|¿|¡|"
    r"\b(necesito|busco|ayuda|pagina|página|sitio|desarrollador|programador|"
    r"wordpress|cotizaci|presupuesto|español|espanol|latam|mexico|méxico|"
    r"argentina|colombia|chile|peru|perú|venezuela|uruguay|ecuador|"
    r"dominicana|hola|gracias|urgente|freelance|proyecto|hosting|"
    r"dominio|ssl|lento|arreglar|error|roto|caido|caído|negocio|pyme|"
    r"tienda|shopify|scraping|freelancer|remoto)\b",
    re.IGNORECASE,
)

_LATAM_SUBREDDIT = re.compile(
    r"\b(spain|es|latam|mexico|méxico|argentina|colombia|chile|peru|perú|venezuela|"
    r"uruguay|ecuador|republica|dominicana|espanol|español|iberoamerica)\b",
    re.IGNORECASE,
)

_LATAM_HOST = re.compile(
    r"\b(forocoches|mediavida|burbuja|emudesc|workana|mercadolibre)\.",
    re.IGNORECASE,
)

_ENGLISH_ONLY = re.compile(
    r"\b(need help|looking for|for hire|hire me|anyone know|please help|"
    r"how do i|my website|wordpress site|i need a|seeking|wanted|"
    r"we are hiring|full time job|salary|resume|cv)\b",
    re.IGNORECASE,
)

_ENGLISH_DOMINANT = re.compile(
    r"\b(the|and|with|this|that|from|your|have|what|when|where|why|how)\b",
    re.IGNORECASE,
)


def looks_spanish(text: str) -> bool:
    """True si el post parece útil para contacto en español."""
    sample = (text or "").strip()
    if not sample:
        return False
    if _ENGLISH_ONLY.search(sample) and not _SPANISH_MARKERS.search(sample):
        return False
    if _SPANISH_MARKERS.search(sample):
        return True
    if _LATAM_SUBREDDIT.search(sample) or _LATAM_HOST.search(sample):
        if _ENGLISH_ONLY.search(sample) and not _SPANISH_MARKERS.search(sample):
            return False
        return True
    if _ENGLISH_ONLY.search(sample):
        return False
    return False


def looks_latam_or_spain(text: str, url: str = "") -> bool:
    """True si el contexto apunta a España o LATAM."""
    combined = f"{text} {url}".lower()
    if _SPANISH_MARKERS.search(combined):
        return True
    if _LATAM_SUBREDDIT.search(combined):
        return True
    if _LATAM_HOST.search(combined):
        return True
    if "reddit.com/r/" in combined:
        sub = combined.split("reddit.com/r/", 1)[-1].split("/", 1)[0]
        if sub and _LATAM_SUBREDDIT.search(sub):
            return True
    if _ENGLISH_DOMINANT.findall(combined) and not _SPANISH_MARKERS.search(combined):
        return False
    return looks_spanish(combined)
