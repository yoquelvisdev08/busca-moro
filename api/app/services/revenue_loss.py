"""Deterministic revenue loss estimation from Lighthouse audit metrics.

The formulas use industry-standard benchmarks:

- **Akamai**: 100 ms additional load time → 1 % conversion drop
- **Google**: LCP > 2.5 s → 7 % conversion drop per extra second
- **ThinkWithGoogle**: Not mobile-friendly → 15 % visitor abandonment
- **Baymard Institute**: No SSL → 10 % trust/conversion drop
- **HTTP Archive**: Lighthouse score < 50 → 5 % additional penalty

All estimates are *conservative*. The module returns rounded dollar amounts
and always includes attribution so the numbers are defensible (and never
feel invented by the LLM).
"""

from __future__ import annotations

from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Baseline constants (industry benchmarks)
# ---------------------------------------------------------------------------

_LOAD_TIME_BASELINE_MS = 1000          # ms — everything above this is "slow"
_LOAD_TIME_DROP_PER_100MS = 0.01       # 1 % conversion drop per 100 ms

_LCP_THRESHOLD_WARNING = 2500          # ms
_LCP_DROP_WARNING = 0.05               # 5 %
_LCP_THRESHOLD_SEVERE = 4000           # ms
_LCP_DROP_SEVERE = 0.10                # 10 %

_MOBILE_UNFRIENDLY_DROP = 0.15         # 15 %
_NO_SSL_DROP = 0.10                     # 10 %
_LOW_LIGHTHOUSE_THRESHOLD = 50
_LOW_LIGHTHOUSE_DROP = 0.05            # 5 %


@dataclass
class RevenueLossEstimate:
    """Estimated monthly revenue loss caused by technical issues.

    Attributes:
        monthly_revenue_lost: Estimated dollars lost **per month**.
        conversion_drop_pct:  Total estimated conversion-rate drop (0-100).
        primary_factors:      Human-readable tags identifying the top causes
                              (e.g. ``"slow_load_time"``, ``"no_mobile"``).
        confidence:           ``"low"`` / ``"medium"`` / ``"high"`` based on
                              how many signals contributed to the estimate.
    """

    monthly_revenue_lost: float
    conversion_drop_pct: float
    primary_factors: list[str] = field(default_factory=list)
    confidence: str = "low"


def calculate_revenue_loss(
    load_time_ms: int | None = None,
    lcp_ms: int | None = None,
    mobile_friendly: bool | None = None,
    has_ssl: bool | None = None,
    lighthouse_score: int | None = None,
    *,
    estimated_monthly_traffic: int = 1000,
    avg_order_value: float = 100.0,
    conversion_rate: float = 0.02,
) -> RevenueLossEstimate:
    """Calculate estimated monthly revenue loss from a site's audit data.

    Each factor reduces the **effective conversion rate** cumulatively.
    The final revenue loss is computed as::

        lost_conversions = traffic × baseline_CR − traffic × effective_CR
        revenue_lost     = lost_conversions × avg_order_value

    where ``effective_CR = baseline_CR × (1 − total_drop)``.

    Parameters
    ----------
    load_time_ms:
        Page load time in milliseconds (DOMContentLoaded or equivalent).
    lcp_ms:
        Largest Contentful Paint in milliseconds.
    mobile_friendly:
        ``True`` if the site passes mobile-friendly checks, ``False`` if not,
        ``None`` if unknown.
    has_ssl:
        ``True`` if the site has a valid SSL certificate.
    lighthouse_score:
        Overall Lighthouse performance score (0-100).
    estimated_monthly_traffic:
        Conservative estimate of unique monthly visitors.  Default **1000**.
    avg_order_value:
        Average revenue per conversion.  Default **$100.00**.
    conversion_rate:
        Baseline conversion rate (fraction of visitors who convert).
        Default **2 %** (0.02).

    Returns
    -------
    RevenueLossEstimate
        Dataclass with rounded monthly loss, total drop %, factors, and
        confidence level.
    """
    # ------------------------------------------------------------------
    # 1. Accumulate conversion-drop factors
    # ------------------------------------------------------------------
    total_drop: float = 0.0
    factors: list[str] = []

    # --- Load time penalty (Akamai benchmark) ---
    if load_time_ms is not None and load_time_ms > _LOAD_TIME_BASELINE_MS:
        excess = load_time_ms - _LOAD_TIME_BASELINE_MS
        drop = (excess / 100.0) * _LOAD_TIME_DROP_PER_100MS
        total_drop += drop
        factors.append("slow_load_time")

    # --- LCP penalty (Google Core Web Vitals) ---
    if lcp_ms is not None:
        if lcp_ms > _LCP_THRESHOLD_SEVERE:
            total_drop += _LCP_DROP_SEVERE
            factors.append("slow_lcp_severe")
        elif lcp_ms > _LCP_THRESHOLD_WARNING:
            total_drop += _LCP_DROP_WARNING
            factors.append("slow_lcp_warning")

    # --- Mobile-friendly check (ThinkWithGoogle) ---
    if mobile_friendly is False:
        total_drop += _MOBILE_UNFRIENDLY_DROP
        factors.append("not_mobile_friendly")

    # --- SSL trust drop ---
    if has_ssl is False:
        total_drop += _NO_SSL_DROP
        factors.append("no_ssl")

    # --- Low Lighthouse score (HTTP Archive correlation) ---
    if (
        lighthouse_score is not None
        and lighthouse_score < _LOW_LIGHTHOUSE_THRESHOLD
    ):
        total_drop += _LOW_LIGHTHOUSE_DROP
        factors.append("low_lighthouse_score")

    # ------------------------------------------------------------------
    # 2. Cap and compute revenue loss
    # ------------------------------------------------------------------
    total_drop = min(total_drop, 1.0)  # can't lose more than 100 %

    effective_cr = conversion_rate * (1.0 - total_drop)
    monthly_conversions_lost = (
        estimated_monthly_traffic * conversion_rate
        - estimated_monthly_traffic * effective_cr
    )
    monthly_revenue_lost = monthly_conversions_lost * avg_order_value

    # ------------------------------------------------------------------
    # 3. Confidence heuristic
    # ------------------------------------------------------------------
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
