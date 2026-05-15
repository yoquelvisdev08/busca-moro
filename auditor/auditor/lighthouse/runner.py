"""Ejecutor headless de Lighthouse sobre un sitio.

Se invoca la CLI oficial de Lighthouse (instalada vía npm en el Dockerfile)
contra un Chromium controlado por Playwright. Se opta por subprocess para
evitar acoplarnos a una librería Node-Python intermedia.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class LighthouseReport:
    raw: dict[str, Any]
    performance: Optional[int]
    seo: Optional[int]
    accessibility: Optional[int]
    best_practices: Optional[int]
    overall: Optional[int]
    fcp_ms: Optional[int]
    lcp_ms: Optional[int]
    cls: Optional[float]
    tbt_ms: Optional[int]


async def run_lighthouse(
    url: str,
    *,
    preset: str = "desktop",
    timeout_seconds: int = 120,
    chrome_flags: str = "--headless=new --no-sandbox --disable-dev-shm-usage",
) -> LighthouseReport:
    """Ejecuta Lighthouse y devuelve un :class:`LighthouseReport`."""

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        out_path = tmp.name

    try:
        cmd = [
            "lighthouse",
            url,
            "--quiet",
            "--output=json",
            f"--output-path={out_path}",
            f"--preset={preset}",
            "--only-categories=performance,accessibility,best-practices,seo",
            f"--chrome-flags={chrome_flags}",
            "--max-wait-for-load=45000",
        ]
        logger.info("lighthouse_start", extra={"url": url, "preset": preset})

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            proc.kill()
            raise RuntimeError("lighthouse timeout") from None

        if proc.returncode != 0:
            raise RuntimeError(f"lighthouse exit {proc.returncode}: {stderr.decode(errors='ignore')[:500]}")

        with open(out_path, "rb") as fp:
            raw = json.loads(fp.read())
    finally:
        try:
            os.unlink(out_path)
        except FileNotFoundError:
            pass

    return _parse_report(raw)


def _parse_report(raw: dict[str, Any]) -> LighthouseReport:
    cats = raw.get("categories", {})
    audits = raw.get("audits", {})

    def _score(name: str) -> Optional[int]:
        cat = cats.get(name)
        if not cat or cat.get("score") is None:
            return None
        return int(round(float(cat["score"]) * 100))

    perf = _score("performance")
    seo = _score("seo")
    acc = _score("accessibility")
    bp = _score("best-practices")

    scores = [s for s in (perf, seo, acc, bp) if s is not None]
    overall = int(round(sum(scores) / len(scores))) if scores else None

    def _audit_int(key: str) -> Optional[int]:
        node = audits.get(key, {})
        raw_val = node.get("numericValue")
        if raw_val is None:
            return None
        return int(round(float(raw_val)))

    def _audit_float(key: str) -> Optional[float]:
        node = audits.get(key, {})
        raw_val = node.get("numericValue")
        if raw_val is None:
            return None
        return float(raw_val)

    return LighthouseReport(
        raw=raw,
        performance=perf,
        seo=seo,
        accessibility=acc,
        best_practices=bp,
        overall=overall,
        fcp_ms=_audit_int("first-contentful-paint"),
        lcp_ms=_audit_int("largest-contentful-paint"),
        cls=_audit_float("cumulative-layout-shift"),
        tbt_ms=_audit_int("total-blocking-time"),
    )
