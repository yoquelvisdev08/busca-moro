"""Content analysis for lead enrichment."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, Optional

from bs4 import BeautifulSoup


@dataclass
class ContentAnalysis:
    last_blog_post_days: Optional[int]
    total_blog_posts: Optional[int]
    has_cta_above_fold: bool
    has_testimonials: bool
    has_pricing_page: bool
    has_portfolio: bool
    has_team_photos: bool
    stock_photo_ratio: float
    seo_title_optimized: bool
    meta_description_present: bool
    heading_structure_valid: bool
    has_schema_org: bool
    has_blog: bool
    has_booking: bool
    revenue_signal: str  # "ecommerce", "subscription", "services", "ads", "none"


def analyze_content(html: str) -> ContentAnalysis:
    """Analyze page content for commercial signals."""
    soup = BeautifulSoup(html, "html.parser")

    # Blog detection
    blog_links = soup.find_all("a", href=re.compile(r"(blog|noticias|articulos|news)", re.I))
    has_blog = len(blog_links) > 0

    # CTA above fold (first 50 lines of HTML)
    first_chunk = "\n".join(html.split("\n")[:50])
    cta_patterns = re.compile(r"(contactar|comprar|reservar|cotizar|solicitar|get.start|free.trial)", re.I)
    has_cta = bool(cta_patterns.search(first_chunk))

    # Testimonials
    testimonial_patterns = re.compile(r"(testimonio|review|opinion|cliente.satisfecho|what.our.clients)", re.I)
    has_testimonials = bool(testimonial_patterns.search(html))

    # Pricing page
    pricing_patterns = re.compile(r"(precio|pricing|plan|tarifa|costo)", re.I)
    has_pricing = bool(pricing_patterns.search(html))

    # Portfolio
    portfolio_patterns = re.compile(r"(portfolio|galeria|trabajos|proyectos|our.work)", re.I)
    has_portfolio = bool(portfolio_patterns.search(html))

    # Schema.org
    has_schema = bool(soup.find("script", type="application/ld+json"))

    # Meta description
    meta_desc = soup.find("meta", attrs={"name": "description"})
    has_meta_desc = meta_desc is not None and meta_desc.get("content", "").strip() != ""

    # SEO title
    title = soup.find("title")
    title_text = title.get_text().strip() if title else ""
    seo_title = len(title_text) > 10 and len(title_text) < 70

    # Heading structure
    h1s = soup.find_all("h1")
    heading_valid = len(h1s) == 1

    # Revenue signal classification
    has_ecommerce = bool(re.search(r"(woocommerce|shopify|magento|prestashop|cart|checkout|add.to.cart)", html, re.I))
    has_payment = bool(re.search(r"(stripe|mercadopago|paypal|square|pago)", html, re.I))
    has_booking = bool(re.search(r"(reserva|booking|turno|calendly|schedule)", html, re.I))

    if has_ecommerce and has_payment:
        revenue_signal = "ecommerce"
    elif has_pricing:
        revenue_signal = "subscription"
    elif has_booking:
        revenue_signal = "services"
    else:
        revenue_signal = "none"

    return ContentAnalysis(
        last_blog_post_days=None,  # Requires scraping blog page separately
        total_blog_posts=None,
        has_cta_above_fold=has_cta,
        has_testimonials=has_testimonials,
        has_pricing_page=has_pricing,
        has_portfolio=has_portfolio,
        has_team_photos=False,  # Requires image analysis
        stock_photo_ratio=0.0,  # Requires image analysis
        seo_title_optimized=seo_title,
        meta_description_present=has_meta_desc,
        heading_structure_valid=heading_valid,
        has_schema_org=has_schema,
        has_blog=has_blog,
        has_booking=has_booking,
        revenue_signal=revenue_signal,
    )


def to_dict(analysis: ContentAnalysis) -> dict[str, Any]:
    return asdict(analysis)
