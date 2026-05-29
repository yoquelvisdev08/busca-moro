"""Unit tests for the deterministic revenue loss calculator."""

from __future__ import annotations

import math

import pytest

from app.services.revenue_loss import RevenueLossEstimate, calculate_revenue_loss


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _est(**overrides):
    """Shortcut that returns defaults merged with *overrides*."""
    defaults = {
        "estimated_monthly_traffic": 1000,
        "avg_order_value": 100.0,
        "conversion_rate": 0.02,
    }
    return {**defaults, **overrides}


# ---------------------------------------------------------------------------
# Perfect scores – no issues at all
# ---------------------------------------------------------------------------


def test_perfect_scores_should_return_zero_loss() -> None:
    """A fast, mobile-friendly, secure, high-Lighthouse site loses nothing."""
    result = calculate_revenue_loss(
        load_time_ms=500,
        lcp_ms=1200,
        mobile_friendly=True,
        has_ssl=True,
        lighthouse_score=95,
        **_est(),
    )
    assert result.monthly_revenue_lost == 0.0
    assert result.conversion_drop_pct == 0.0
    assert result.primary_factors == []
    assert result.confidence == "low"


# ---------------------------------------------------------------------------
# Worst scores – everything is broken
# ---------------------------------------------------------------------------


def test_worst_scores_should_cap_at_100_percent() -> None:
    """Extremely bad site: drop must be capped at 100 % (not exceed it)."""
    result = calculate_revenue_loss(
        load_time_ms=12_000,  # 11 s excess → 110 %
        lcp_ms=8_000,         # severe → 10 %
        mobile_friendly=False,  # 15 %
        has_ssl=False,          # 10 %
        lighthouse_score=10,    # 5 %
        **_est(),
    )
    assert result.conversion_drop_pct == 100.0
    # Effective CR = 0 → ALL baseline conversions are lost
    expected_lost = 1000 * 0.02 * 100.0  # 20 conversions × $100 = $2000
    assert math.isclose(result.monthly_revenue_lost, expected_lost)
    assert result.confidence == "high"
    assert len(result.primary_factors) >= 4


# ---------------------------------------------------------------------------
# Parametrized tests for individual factors
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "load_ms,expected_drop_pct",
    [
        (1000, 0.0),   # at baseline — no penalty
        (1100, 1.0),   # +100 ms = 1 %
        (1500, 5.0),   # +500 ms = 5 %
        (3000, 20.0),  # +2000 ms = 20 %
        (500, 0.0),    # faster than baseline
        (999, 0.0),    # just under baseline
    ],
)
def test_load_time_penalty(load_ms: int, expected_drop_pct: float) -> None:
    """Akamai benchmark: every 100 ms over 1000 ms costs 1 % conversion."""
    result = calculate_revenue_loss(
        load_time_ms=load_ms,
        **_est(),
    )
    assert result.conversion_drop_pct == expected_drop_pct


@pytest.mark.parametrize(
    "lcp_ms,expected_drop_pct",
    [
        (2500, 0.0),   # right at threshold — no penalty
        (2501, 5.0),   # just over warning → 5 %
        (3900, 5.0),   # still in warning range
        (4000, 5.0),   # at severe threshold → still warning (strictly >)
        (4001, 10.0),  # into severe
        (8000, 10.0),  # deep severe
        (1500, 0.0),   # fast LCP
    ],
)
def test_lcp_penalty(lcp_ms: int, expected_drop_pct: float) -> None:
    """Google CWV benchmarks for LCP thresholds."""
    result = calculate_revenue_loss(
        lcp_ms=lcp_ms,
        **_est(),
    )
    assert result.conversion_drop_pct == expected_drop_pct


@pytest.mark.parametrize(
    "mobile_friendly,expected_drop_pct",
    [
        (False, 15.0),
        (True, 0.0),
        (None, 0.0),  # unknown → no penalty
    ],
)
def test_mobile_friendly_penalty(
    mobile_friendly: bool | None, expected_drop_pct: float
) -> None:
    result = calculate_revenue_loss(
        mobile_friendly=mobile_friendly,
        **_est(),
    )
    assert result.conversion_drop_pct == expected_drop_pct


@pytest.mark.parametrize(
    "has_ssl,expected_drop",
    [
        (False, 10.0),
        (True, 0.0),
        (None, 0.0),
    ],
)
def test_ssl_penalty(has_ssl: bool | None, expected_drop: float) -> None:
    result = calculate_revenue_loss(has_ssl=has_ssl, **_est())
    assert result.conversion_drop_pct == expected_drop


@pytest.mark.parametrize(
    "lh_score,expected_drop",
    [
        (49, 5.0),
        (10, 5.0),
        (0, 5.0),
        (50, 0.0),
        (80, 0.0),
        (100, 0.0),
        (None, 0.0),
    ],
)
def test_lighthouse_score_penalty(
    lh_score: int | None, expected_drop: float
) -> None:
    result = calculate_revenue_loss(lighthouse_score=lh_score, **_est())
    assert result.conversion_drop_pct == expected_drop


# ---------------------------------------------------------------------------
# Combined scenario tests
# ---------------------------------------------------------------------------


def test_combined_slow_load_and_no_ssl() -> None:
    """Load: 2000 ms (+10 %) + No SSL (10 %) = 20 % drop."""
    result = calculate_revenue_loss(
        load_time_ms=2000,  # 1000 excess → 10 %
        has_ssl=False,      # 10 %
        **_est(),
    )
    assert result.conversion_drop_pct == 20.0
    # lost = 1000 * 0.02 * 0.20 * 100 = 400
    assert math.isclose(result.monthly_revenue_lost, 400.0)
    assert set(result.primary_factors) == {"slow_load_time", "no_ssl"}
    assert result.confidence == "medium"


def test_segment_a_typical_slow_site() -> None:
    """Typical Segment A: slow + no mobile + no SSL + bad Lighthouse."""
    result = calculate_revenue_loss(
        load_time_ms=4200,       # 3200 excess → 32 %
        lcp_ms=5000,              # severe → 10 %
        mobile_friendly=False,    # 15 %
        has_ssl=False,            # 10 %
        lighthouse_score=30,      # 5 %
        **_est(),
    )
    # total = 32 + 10 + 15 + 10 + 5 = 72 % → effective CR = 0.02 * 0.28 = 0.0056
    assert result.conversion_drop_pct == 72.0
    expected_lost = (1000 * 0.02 - 1000 * 0.02 * 0.28) * 100.0  # = 20 - 5.6 = 14.4 * 100 = 1440
    assert math.isclose(result.monthly_revenue_lost, 1440.0)
    assert result.confidence == "high"


def test_low_severity_only_warning() -> None:
    """Only LCP warning, nothing else."""
    result = calculate_revenue_loss(
        lcp_ms=3000,  # 5 %
        **_est(),
    )
    assert result.conversion_drop_pct == 5.0
    # lost = 1000 * 0.02 * 0.05 * 100 = 100
    assert math.isclose(result.monthly_revenue_lost, 100.0)
    assert result.confidence == "medium"
    assert "slow_lcp_warning" in result.primary_factors


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


def test_zero_traffic_should_return_zero_loss() -> None:
    """No visitors → no revenue to lose."""
    result = calculate_revenue_loss(
        load_time_ms=5000,
        has_ssl=False,
        avg_order_value=100.0,
        conversion_rate=0.02,
        estimated_monthly_traffic=0,
    )
    assert result.monthly_revenue_lost == 0.0
    assert result.conversion_drop_pct > 0  # drop is still computed


def test_missing_all_data_should_return_zero() -> None:
    """When no metrics are provided, the estimate is zero."""
    result = calculate_revenue_loss(**_est())
    assert result.monthly_revenue_lost == 0.0
    assert result.conversion_drop_pct == 0.0
    assert result.confidence == "low"


def test_high_traffic_amplifies_loss() -> None:
    """10× traffic = 10× revenue loss with same drop."""
    result = calculate_revenue_loss(
        has_ssl=False,  # 10 %
        avg_order_value=100.0,
        conversion_rate=0.02,
        estimated_monthly_traffic=10_000,
    )
    # lost = 10000 * 0.02 * 0.10 * 100 = 2000
    assert math.isclose(result.monthly_revenue_lost, 2000.0)


def test_high_aov_amplifies_loss() -> None:
    """Higher average order value increases dollar impact."""
    result = calculate_revenue_loss(
        has_ssl=False,  # 10 %
        estimated_monthly_traffic=1000,
        conversion_rate=0.02,
        avg_order_value=500.0,
    )
    # lost = 1000 * 0.02 * 0.10 * 500 = 1000
    assert math.isclose(result.monthly_revenue_lost, 1000.0)


def test_none_values_are_treated_as_missing() -> None:
    """None values should not contribute to drop."""
    result = calculate_revenue_loss(
        load_time_ms=None,
        lcp_ms=None,
        mobile_friendly=None,
        has_ssl=None,
        lighthouse_score=None,
        **_est(),
    )
    assert result.monthly_revenue_lost == 0.0


def test_dataclass_is_returned() -> None:
    """The function must return a RevenueLossEstimate instance."""
    result = calculate_revenue_loss(**_est())
    assert isinstance(result, RevenueLossEstimate)
    assert hasattr(result, "monthly_revenue_lost")
    assert hasattr(result, "conversion_drop_pct")
    assert hasattr(result, "primary_factors")
    assert hasattr(result, "confidence")


# ---------------------------------------------------------------------------
# Integration-style test: verify prompt-friendly output structure
# ---------------------------------------------------------------------------


def test_segment_a_prompt_contains_dollar_prefix() -> None:
    """When load_time_ms > 2000, the estimate should be significant (> $0)
    so that a Segment A prompt can lead with a dollar amount."""
    result = calculate_revenue_loss(
        load_time_ms=4200,
        lcp_ms=5000,
        mobile_friendly=False,
        has_ssl=False,
        lighthouse_score=30,
        **_est(),
    )
    # The revenue loss should be substantial enough for a "$" prefix
    assert result.monthly_revenue_lost > 100  # at least $100
    assert result.conversion_drop_pct > 10   # significant drop


def test_zero_loss_for_fast_secure_site() -> None:
    """A fast, mobile-friendly, secure site with great Lighthouse should show
    zero loss — i.e., Segment C/D prompts should NOT have a dollar prefix."""
    result = calculate_revenue_loss(
        load_time_ms=800,
        lcp_ms=1200,
        mobile_friendly=True,
        has_ssl=True,
        lighthouse_score=90,
        **_est(),
    )
    assert result.monthly_revenue_lost == 0.0
    assert "$" not in str(result.monthly_revenue_lost) or result.monthly_revenue_lost == 0.0
