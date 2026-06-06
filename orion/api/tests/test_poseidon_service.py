"""Tests Poseidon service helpers."""

from poseidon_api.service import detect_platform, extract_business_url


def test_extract_business_url_skips_social():
    url = extract_business_url(
        "Mi tienda https://mitienda.com.ar no carga",
        "reddit post",
    )
    assert url == "https://mitienda.com.ar"


def test_extract_business_url_none_when_only_social():
    assert extract_business_url("Mira reddit.com/r/test", "") is None


def test_detect_platform_reddit():
    assert detect_platform("https://reddit.com/r/test/comments/1") == "reddit"
