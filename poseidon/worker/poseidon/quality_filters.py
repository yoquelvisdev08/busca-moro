"""Filtros de calidad en el worker (espejo de poseidon_api.quality)."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from poseidon.searx_client import SearchHit

_SPANISH_MARKERS = re.compile(
    r"[ñáéíóúü]|¿|¡|"
    r"\b(necesito|busco|ayuda|pagina|página|sitio|desarrollador|programador|"
    r"wordpress|cotizaci|presupuesto|español|espanol|latam|mexico|méxico|"
    r"argentina|colombia|chile|peru|perú|venezuela|uruguay|ecuador|"
    r"dominicana|urgente|freelance|proyecto|hosting|dominio|ssl|lento|"
    r"arreglar|error|roto|caido|caído|negocio|pyme|tienda|shopify|remoto)\b",
    re.IGNORECASE,
)

_DEMAND_INTENT = re.compile(
    r"\b(necesito|busco|buscando|presupuesto|cotizaci|cu[aá]nto cuesta|"
    r"ayuda con mi|mi (pagina|página|sitio|web|tienda|negocio)|"
    r"hacer (mi|una) (web|pagina|página|sitio)|"
    r"wordpress.*(roto|lento|error|ayuda|arreglar)|"
    r"hosting.*(caido|caído|down)|error 500|no carga|no funciona|"
    r"pantalla blanca|sitio (caido|caído)|tienda online)\b",
    re.IGNORECASE,
)

_TUTORIAL_NOISE = re.compile(
    r"\b(tutorial|mastering|dominar|gu[ií]a completa|aprender a|how to|"
    r"proyecto escolar|school project|blog post|zenrows|trabajos freelance de|"
    r"jobs\?skills=|/jobs\?|megathread|tips para hacer)\b",
    re.IGNORECASE,
)

_NOISE_TITLE = re.compile(
    r"^\[(for hire|offer|promo|hiring|task)\]|"
    r"\b(we're hiring|remote freelance developer wanted)\b",
    re.IGNORECASE,
)

_BLOCKED_SUBREDDITS = frozenset(
    {
        "slavelabour",
        "forhire",
        "hireahacker",
        "jobs",
        "jobbit",
        "freelance",
        "freelanceuk",
        "workonline",
        "digitalnomad",
        "remotework",
        "cscareerquestions",
        "webdev",
        "programming",
        "learnprogramming",
        "learnpython",
        "python",
        "flutterdev",
        "smallbusiness",
        "entrepreneur",
        "startups",
        "datascience",
        "webscraping",
        "sideproject",
        "wordpress",
        "programacion",
        "programadores",
    }
)


def reddit_subreddit(url: str) -> str | None:
    lower = (url or "").lower()
    if "reddit.com/r/" not in lower:
        return None
    return lower.split("reddit.com/r/", 1)[-1].split("/", 1)[0]


def url_is_stale_source(url: str) -> bool:
    lower = (url or "").lower()
    if "?tl=" in lower or "&tl=" in lower:
        return True
    if "workana.com" in lower and "/jobs" in lower:
        return True
    if "freelancer.com" in lower and "/jobs/" in lower:
        return True
    if "reddit.com" in lower and "/comments/" not in lower:
        return True
    return False


def is_discovery_hit_allowed(hit: SearchHit) -> bool:
    if url_is_stale_source(hit.url):
        return False
    sub = reddit_subreddit(hit.url)
    if sub and sub in _BLOCKED_SUBREDDITS:
        return False
    sample = f"{hit.title} {hit.snippet} {hit.query}"
    if _NOISE_TITLE.search(hit.title or ""):
        return False
    if _TUTORIAL_NOISE.search(sample):
        return False
    if not _SPANISH_MARKERS.search(sample):
        return False
    if not _DEMAND_INTENT.search(sample):
        return False
    return True
