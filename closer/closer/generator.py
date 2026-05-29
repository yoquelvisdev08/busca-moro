"""Revenue loss bridge for Closer prompts.

This module mirrors the formula in ``api/app/services/revenue_loss.py``
so the Closer can compute estimates locally from audit data without a
network call to the API service.  Both copies MUST stay in sync.

Industry benchmarks used:
- Akamai:    100 ms extra load time → 1 % conversion drop
- Google:    LCP > 2.5 s → 5-10 % penalty
- ThinkWithGoogle: not mobile-friendly → 15 % drop
- Baymard:   no SSL → 10 % trust drop
- HTTP Archive: Lighthouse < 50 → 5 % penalty
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# Baseline constants (keep in sync with api/app/services/revenue_loss.py)
# ---------------------------------------------------------------------------

_LOAD_TIME_BASELINE_MS = 1000
_LOAD_TIME_DROP_PER_100MS = 0.01

_LCP_THRESHOLD_WARNING = 2500
_LCP_DROP_WARNING = 0.05
_LCP_THRESHOLD_SEVERE = 4000
_LCP_DROP_SEVERE = 0.10

_MOBILE_UNFRIENDLY_DROP = 0.15
_NO_SSL_DROP = 0.10
_LOW_LIGHTHOUSE_THRESHOLD = 50
_LOW_LIGHTHOUSE_DROP = 0.05

# Default conservative estimates
_DEFAULT_TRAFFIC = 1000
_DEFAULT_AOV = 100.0
_DEFAULT_CR = 0.02

DISCLAIMER = (
    "Based on industry averages (Google/Akamai benchmarks). Actual results vary."
)


# ---------------------------------------------------------------------------
# Dataclass
# ---------------------------------------------------------------------------


@dataclass
class RevenueLossEstimate:
    """Mirror of ``api.app.services.revenue_loss.RevenueLossEstimate``."""

    monthly_revenue_lost: float
    conversion_drop_pct: float
    primary_factors: list[str] = field(default_factory=list)
    confidence: str = "low"


# ---------------------------------------------------------------------------
# Calculation
# ---------------------------------------------------------------------------


def calculate_revenue_loss(
    load_time_ms: int | None = None,
    lcp_ms: int | None = None,
    mobile_friendly: bool | None = None,
    has_ssl: bool | None = None,
    lighthouse_score: int | None = None,
    *,
    estimated_monthly_traffic: int = _DEFAULT_TRAFFIC,
    avg_order_value: float = _DEFAULT_AOV,
    conversion_rate: float = _DEFAULT_CR,
) -> RevenueLossEstimate:
    """Calculate monthly revenue loss from audit metrics.

    Keep this implementation byte-identical with
    ``api.app.services.revenue_loss.calculate_revenue_loss()``.
    """
    total_drop: float = 0.0
    factors: list[str] = []

    # Load time
    if load_time_ms is not None and load_time_ms > _LOAD_TIME_BASELINE_MS:
        excess = load_time_ms - _LOAD_TIME_BASELINE_MS
        total_drop += (excess / 100.0) * _LOAD_TIME_DROP_PER_100MS
        factors.append("slow_load_time")

    # LCP
    if lcp_ms is not None:
        if lcp_ms > _LCP_THRESHOLD_SEVERE:
            total_drop += _LCP_DROP_SEVERE
            factors.append("slow_lcp_severe")
        elif lcp_ms > _LCP_THRESHOLD_WARNING:
            total_drop += _LCP_DROP_WARNING
            factors.append("slow_lcp_warning")

    # Mobile
    if mobile_friendly is False:
        total_drop += _MOBILE_UNFRIENDLY_DROP
        factors.append("not_mobile_friendly")

    # SSL
    if has_ssl is False:
        total_drop += _NO_SSL_DROP
        factors.append("no_ssl")

    # Lighthouse
    if (
        lighthouse_score is not None
        and lighthouse_score < _LOW_LIGHTHOUSE_THRESHOLD
    ):
        total_drop += _LOW_LIGHTHOUSE_DROP
        factors.append("low_lighthouse_score")

    total_drop = min(total_drop, 1.0)

    effective_cr = conversion_rate * (1.0 - total_drop)
    monthly_conversions_lost = (
        estimated_monthly_traffic * conversion_rate
        - estimated_monthly_traffic * effective_cr
    )
    monthly_revenue_lost = monthly_conversions_lost * avg_order_value

    if len(factors) >= 3:
        confidence = "high"
    elif len(factors) >= 1:
        confidence = "medium"
    else:
        confidence = "low"

    return RevenueLossEstimate(
        monthly_revenue_lost=round(monthly_revenue_lost, 2),
        conversion_drop_pct=round(total_drop * 100.0, 1),
        primary_factors=factors,
        confidence=confidence,
    )


# ---------------------------------------------------------------------------
# Prompt variable builders
# ---------------------------------------------------------------------------


def build_revenue_loss_summary(estimate: RevenueLossEstimate) -> str:
    """Format the revenue loss estimate as a human-readable summary string.

    Returns an empty string when the loss is negligible (≤ $1).
    """

    if estimate.monthly_revenue_lost <= 1.0:
        return ""

    factors_label = _human_factors(estimate.primary_factors)
    return (
        f"Estimated revenue loss: **${estimate.monthly_revenue_lost:,.0f}/month** "
        f"({estimate.conversion_drop_pct:.0f}% conversion drop from "
        f"{factors_label})."
    )


def build_revenue_loss_lead(estimate: RevenueLossEstimate) -> str:
    """Build the hard-hitting "$X/month lost" lead for Segment A/B.

    Returns empty string if loss is ≤ $1.
    """

    if estimate.monthly_revenue_lost <= 1.0:
        return ""

    return (
        f"Based on your site's performance metrics, you are losing approximately "
        f"**${estimate.monthly_revenue_lost:,.0f}/month** in revenue due to "
        f"technical issues. "
        + DISCLAIMER
    )


def build_qualitative_impact(estimate: RevenueLossEstimate) -> str:
    """Build a qualitative impact statement for Segment C/D (no dollar amounts).

    Always returns a string — even when loss is zero, it gives a neutral
    observation.
    """

    factors = estimate.primary_factors

    if not factors:
        return (
            "Your site has potential for improvement. Even small technical fixes "
            "can increase visitor trust and conversions."
        )

    if "slow_load_time" in factors or "slow_lcp" in factors[0]:
        return (
            "Your site's load speed may be causing you to lose potential "
            "clients every day — visitors leave slow sites in seconds."
        )
    if "not_mobile_friendly" in factors:
        return (
            "Many visitors are on mobile, and your site may not display "
            "properly — this costs you clients looking for your services."
        )
    if "no_ssl" in factors:
        return (
            "Visitors may be hesitant to trust your site without a security "
            "certificate — this can cost you potential clients."
        )

    return (
        "Your site has technical issues that could be affecting how many "
        "visitors become clients. Fixing these can increase your revenue."
    )


# ---------------------------------------------------------------------------
# Top-level wrapper called by IntelligenceEngine
# ---------------------------------------------------------------------------


def prepare_prompt_variables(audit: dict[str, Any]) -> dict[str, str]:
    """Extract metrics from an audit dict and return prompt-ready strings.

    Called by ``IntelligenceEngine.generate()`` before the LLM calls so
    revenue loss data is available as ``{variable}`` placeholders in
    ``closer.prompts`` templates.
    """

    # Extract metrics safely from the audit dict
    load_time_ms = _safe_int(audit.get("load_time_ms"))
    lcp_ms = _safe_int(audit.get("largest_contentful_paint_ms"))
    mobile_friendly = _safe_bool(audit.get("mobile_friendly"))
    has_ssl = _safe_bool(audit.get("has_ssl"))
    lighthouse_score = _safe_int(audit.get("lighthouse_score"))

    estimate = calculate_revenue_loss(
        load_time_ms=load_time_ms,
        lcp_ms=lcp_ms,
        mobile_friendly=mobile_friendly,
        has_ssl=has_ssl,
        lighthouse_score=lighthouse_score,
    )

    return {
        "revenue_loss_summary": build_revenue_loss_summary(estimate),
        "revenue_loss_lead": build_revenue_loss_lead(estimate),
        "qualitative_impact": build_qualitative_impact(estimate),
        "estimated_monthly_revenue": _format_dollar(estimate.monthly_revenue_lost),
        "disclaimer": DISCLAIMER if estimate.monthly_revenue_lost > 1.0 else "",
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _safe_int(value: Any) -> int | None:
    """Coerce to int, return None on failure."""
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_bool(value: Any) -> bool | None:
    """Coerce to bool, return None on ambiguous input."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        low = value.strip().lower()
        if low in ("true", "yes", "1"):
            return True
        if low in ("false", "no", "0"):
            return False
        return None
    try:
        return bool(value)
    except (TypeError, ValueError):
        return None


def _human_factors(factors: list[str]) -> str:
    """Convert factor tags to human-readable English."""
    mapping = {
        "slow_load_time": "slow page load",
        "slow_lcp_warning": "slow largest content paint",
        "slow_lcp_severe": "severely slow largest content paint",
        "not_mobile_friendly": "not mobile-friendly",
        "no_ssl": "no SSL certificate",
        "low_lighthouse_score": "low Lighthouse score",
    }
    return ", ".join(mapping.get(f, f) for f in factors)


def _format_dollar(amount: float) -> str:
    if amount <= 0:
        return "$0"
    if amount >= 1_000_000:
        return f"${amount / 1_000_000:.1f}M"
    if amount >= 1_000:
        return f"${amount / 1_000:.1f}K"
    return f"${amount:,.0f}"
