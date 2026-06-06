"""Tests intent scoring."""

from poseidon.intent import keyword_score
from poseidon.searx_client import SearchHit


def test_keyword_score_detects_web_help():
    hit = SearchHit(
        url="https://www.reddit.com/r/spain/comments/abc/necesito_ayuda_web/",
        title="Necesito ayuda con mi pagina web lenta",
        snippet="Busco alguien que me arregle wordpress sin complicarme",
        query="site:reddit.com ayuda web",
    )
    score, category = keyword_score(hit)
    assert score >= 30
    assert category in {"web_dev", "wordpress", "performance"}


def test_keyword_score_rejects_hiring_noise():
    hit = SearchHit(
        url="https://www.reddit.com/r/jobs/comments/x/",
        title="Empresa contrata desarrollador senior remoto",
        snippet="We are hiring full time",
        query="desarrollador",
    )
    score, _ = keyword_score(hit)
    assert score == 0
