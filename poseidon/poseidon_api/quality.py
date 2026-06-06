"""Heurísticas compartidas para filtrar ruido en señales Poseidon."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

_SPANISH_MARKERS = re.compile(
    r"[ñáéíóúü]|¿|¡|"
    r"\b(necesito|busco|ayuda|pagina|página|sitio|desarrollador|programador|"
    r"wordpress|cotizaci|presupuesto|español|espanol|latam|mexico|méxico|"
    r"argentina|colombia|chile|peru|perú|venezuela|uruguay|ecuador|"
    r"dominicana|hola|gracias|urgente|freelance|proyecto|hosting|"
    r"dominio|ssl|lento|arreglar|error|roto|caido|caído|negocio|pyme|"
    r"tienda|shopify|freelancer|remoto)\b",
    re.IGNORECASE,
)

_LATAM_SUBREDDIT = re.compile(
    r"\b(spain|es|latam|mexico|méxico|argentina|colombia|chile|peru|perú|venezuela|"
    r"uruguay|ecuador|republicadominicana|dominicana|espanol|español|iberoamerica)\b",
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

_ENGLISH_ONLY = re.compile(
    r"\b(need help|looking for|for hire|hire me|anyone know|please help|"
    r"how do i|my website|wordpress site|i need a|seeking|wanted|"
    r"we are hiring|full time job|salary|resume|cv|\[hiring\])\b",
    re.IGNORECASE,
)

_NOISE_TITLE = re.compile(
    r"^\[(for hire|offer|promo|hiring|task)\]|"
    r"\b(we're hiring|remote freelance developer wanted)\b",
    re.IGNORECASE,
)

_TUTORIAL_NOISE = re.compile(
    r"\b(tutorial|mastering|dominar|gu[ií]a completa|aprender a|how to|"
    r"proyecto escolar|school project|blog post|zenrows|trabajos freelance de|"
    r"jobs\?skills=|/jobs\?|hilo informativo|megathread|tips para hacer)\b",
    re.IGNORECASE,
)

_SNIPPET_YEAR = re.compile(r"\b(20\d{2})\b")

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


def url_is_stale_source(source_url: str) -> bool:
    lower = (source_url or "").lower()
    if "?tl=" in lower or "&tl=" in lower:
        return True
    if "workana.com" in lower and "/jobs" in lower:
        return True
    if "freelancer.com" in lower and "/jobs/" in lower:
        return True
    if "reddit.com" in lower and "/comments/" not in lower:
        return True
    return False


def content_looks_too_old(*, title: str, snippet: str, max_age_days: int = 45) -> bool:
    sample = f"{title} {snippet}"
    years = [int(y) for y in _SNIPPET_YEAR.findall(sample) if 2008 <= int(y) <= datetime.now().year]
    if not years:
        return False
    newest_year = max(years)
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    if newest_year < cutoff.year - 1:
        return True
    if newest_year <= datetime.now().year - 2:
        return True
    return False


def has_demand_intent(*, title: str, snippet: str) -> bool:
    sample = f"{title} {snippet}"
    return bool(_DEMAND_INTENT.search(sample))


def signal_is_actionable(
    *,
    title: str,
    snippet: str,
    source_url: str,
    intent_score: int,
    min_score: int = 32,
    max_age_days: int = 45,
    detected_at: datetime | None = None,
) -> bool:
    if intent_score < min_score:
        return False
    if is_noise_signal(
        title=title,
        snippet=snippet,
        source_url=source_url,
        max_age_days=max_age_days,
    ):
        return False
    if not looks_spanish_signal(title=title, snippet=snippet, source_url=source_url):
        return False
    if not has_demand_intent(title=title, snippet=snippet):
        return False
    if detected_at is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
        if detected_at.tzinfo is None:
            detected_at = detected_at.replace(tzinfo=timezone.utc)
        if detected_at < cutoff:
            return False
    return True


def is_noise_signal(
    *,
    title: str,
    snippet: str,
    source_url: str,
    max_age_days: int = 45,
) -> bool:
    if _NOISE_TITLE.search((title or "").strip()):
        return True
    if url_is_stale_source(source_url):
        return True
    if content_looks_too_old(title=title, snippet=snippet, max_age_days=max_age_days):
        return True
    sub = reddit_subreddit(source_url)
    if sub and sub in _BLOCKED_SUBREDDITS:
        return True
    sample = f"{title} {snippet}".lower()
    if _TUTORIAL_NOISE.search(sample):
        return True
    if _ENGLISH_ONLY.search(sample) and not _SPANISH_MARKERS.search(sample):
        return True
    if re.search(r"\[hiring\]", sample, re.IGNORECASE):
        return True
    return False


def looks_spanish_signal(*, title: str, snippet: str, source_url: str) -> bool:
    sample = f"{title} {snippet} {source_url}"
    if _SPANISH_MARKERS.search(sample):
        return True
    sub = reddit_subreddit(source_url)
    if sub and _LATAM_SUBREDDIT.search(sub):
        if _ENGLISH_ONLY.search(sample) and not _SPANISH_MARKERS.search(sample):
            return False
        return True
    if _LATAM_SUBREDDIT.search(sample):
        return True
    return False
