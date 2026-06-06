"""Tests calidad de señales."""

from datetime import datetime, timezone

from poseidon_api.quality import is_noise_signal, signal_is_actionable


def test_hiring_title_is_noise():
    assert is_noise_signal(
        title="[Hiring] Remote Freelance Web Developer",
        snippet="We need a developer",
        source_url="https://www.reddit.com/r/forhire/comments/x/test/",
    )


def test_translated_old_reddit_is_noise():
    assert is_noise_signal(
        title="Web Scraping : r/Python",
        snippet="Hola, tutorial from 2021",
        source_url="https://www.reddit.com/r/Python/comments/abc/web/?tl=es-419",
    )


def test_spanish_demand_is_actionable():
    assert signal_is_actionable(
        title="Necesito ayuda con mi pagina web lenta",
        snippet="Busco alguien en español para arreglar wordpress",
        source_url="https://www.reddit.com/r/spain/comments/abc/test/",
        intent_score=38,
    )


def test_tutorial_scraping_is_not_actionable():
    assert not signal_is_actionable(
        title="Dominar el web scraping en Python",
        snippet="Guía completa para aprender scraping en 2021",
        source_url="https://www.reddit.com/r/Python/comments/p2bo74/test/",
        intent_score=38,
    )


def test_workana_listing_is_noise():
    assert is_noise_signal(
        title="Trabajos Freelance de Web Scraping",
        snippet="Workana",
        source_url="https://www.workana.com/es/jobs?skills=web-scraping",
    )
