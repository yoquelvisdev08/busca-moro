"""Tests language detection."""

from poseidon.language import looks_latam_or_spain, looks_spanish


def test_looks_spanish_detects_help_request():
    assert looks_spanish("Necesito ayuda con mi pagina web lenta")


def test_looks_spanish_rejects_english_hiring():
    assert not looks_spanish("We are hiring a senior web developer full time")


def test_looks_latam_from_subreddit_url():
    assert looks_latam_or_spain(
        "Ayuda con wordpress",
        "https://www.reddit.com/r/mexico/comments/abc/test/",
    )


def test_looks_latam_from_forum_host():
    assert looks_latam_or_spain(
        "Busco desarrollador",
        "https://forocoches.com/foro/showthread.php?t=123",
    )
