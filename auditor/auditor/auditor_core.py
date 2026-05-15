"""Núcleo del Auditor: orquesta Playwright + Lighthouse + extracción."""

from __future__ import annotations

import logging
import os
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from playwright.async_api import Browser, async_playwright

from auditor.config import Settings
from auditor.extractors.contacts import extract_emails, extract_phones, extract_socials
from auditor.lighthouse.runner import LighthouseReport, run_lighthouse
from auditor.stealth.browser import apply_stealth, new_stealth_context
from auditor.stealth.rotation import Rotator

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class AuditResult:
    lead_id: str
    url: str
    status: str
    lighthouse_score: Optional[int]
    performance_score: Optional[int]
    seo_score: Optional[int]
    accessibility_score: Optional[int]
    best_practices_score: Optional[int]
    mobile_friendly: Optional[bool]
    has_ssl: Optional[bool]
    load_time_ms: Optional[int]
    first_contentful_paint_ms: Optional[int]
    largest_contentful_paint_ms: Optional[int]
    cumulative_layout_shift: Optional[float]
    total_blocking_time_ms: Optional[int]
    detected_tech: dict[str, Any]
    extracted_contacts: dict[str, Any]
    raw_json_data: dict[str, Any]
    screenshot_path: Optional[str]
    user_agent: Optional[str]
    proxy_used: Optional[str]
    error_message: Optional[str]
    started_at: datetime
    finished_at: datetime

    def to_payload(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["started_at"] = self.started_at.isoformat()
        payload["finished_at"] = self.finished_at.isoformat()
        return payload


class Auditor:
    """Encapsula la lógica para auditar un único sitio."""

    def __init__(self, settings: Settings, rotator: Rotator) -> None:
        self._settings = settings
        self._rotator = rotator
        Path(settings.screenshot_dir).mkdir(parents=True, exist_ok=True)

    async def audit(self, lead_id: str, url: str) -> AuditResult:
        started = datetime.now(tz=timezone.utc)
        user_agent = self._rotator.pick_user_agent()
        proxy = self._rotator.pick_proxy()

        screenshot_path: Optional[str] = None
        load_time_ms: Optional[int] = None
        mobile_friendly: Optional[bool] = None
        has_ssl: Optional[bool] = None
        detected_tech: dict[str, Any] = {}
        contacts: dict[str, Any] = {}
        error: Optional[str] = None

        async with async_playwright() as pw:
            browser: Browser = await pw.chromium.launch(
                headless=self._settings.headless,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )

            try:
                context = await new_stealth_context(
                    browser,
                    user_agent=user_agent,
                    viewport_width=self._settings.viewport_width,
                    viewport_height=self._settings.viewport_height,
                    proxy=proxy,
                )
                page = await context.new_page()
                await apply_stealth(page)

                start = time.perf_counter()
                response = await page.goto(
                    url,
                    wait_until="domcontentloaded",
                    timeout=self._settings.nav_timeout_ms,
                )
                load_time_ms = int((time.perf_counter() - start) * 1000)
                has_ssl = page.url.startswith("https://")

                if response is not None:
                    server = response.headers.get("server")
                    powered_by = response.headers.get("x-powered-by")
                    if server:
                        detected_tech["server"] = server
                    if powered_by:
                        detected_tech["x_powered_by"] = powered_by

                # Above-the-fold screenshot
                screenshot_path = await self._capture_above_the_fold(page, lead_id)

                # Mobile-friendly heuristic via emulación
                mobile_friendly = await self._is_mobile_friendly(context, url)

                html = await page.content()
                contacts = {
                    "emails": extract_emails(html),
                    "phones": extract_phones(html),
                    "socials": extract_socials(html),
                }

                await context.close()
            except Exception as exc:  # noqa: BLE001
                error = f"playwright_error: {exc}"
                logger.exception("audit_failed", extra={"url": url, "lead_id": lead_id})
            finally:
                await browser.close()

        report: Optional[LighthouseReport] = None
        lighthouse_error: Optional[str] = None
        try:
            report = await run_lighthouse(
                url=url,
                preset=self._settings.lighthouse_preset,
                timeout_seconds=120,
            )
        except Exception as exc:  # noqa: BLE001
            lighthouse_error = f"lighthouse_error: {exc}"
            logger.warning("lighthouse_failed", extra={"url": url, "err": str(exc)})

        finished = datetime.now(tz=timezone.utc)

        playwright_succeeded = error is None and load_time_ms is not None
        combined_error = (
            "; ".join(part for part in (error, lighthouse_error) if part) or None
        )

        return AuditResult(
            lead_id=lead_id,
            url=url,
            status="completed" if playwright_succeeded else "failed",
            lighthouse_score=report.overall if report else None,
            performance_score=report.performance if report else None,
            seo_score=report.seo if report else None,
            accessibility_score=report.accessibility if report else None,
            best_practices_score=report.best_practices if report else None,
            mobile_friendly=mobile_friendly,
            has_ssl=has_ssl,
            load_time_ms=load_time_ms,
            first_contentful_paint_ms=report.fcp_ms if report else None,
            largest_contentful_paint_ms=report.lcp_ms if report else None,
            cumulative_layout_shift=report.cls if report else None,
            total_blocking_time_ms=report.tbt_ms if report else None,
            detected_tech=detected_tech,
            extracted_contacts=contacts,
            raw_json_data=report.raw if report else {},
            screenshot_path=screenshot_path,
            user_agent=user_agent,
            proxy_used=proxy,
            error_message=combined_error,
            started_at=started,
            finished_at=finished,
        )

    async def _capture_above_the_fold(self, page, lead_id: str) -> Optional[str]:
        filename = f"{lead_id}_{uuid.uuid4().hex}.jpg"
        full_path = os.path.join(self._settings.screenshot_dir, filename)
        try:
            await page.screenshot(
                path=full_path,
                type="jpeg",
                quality=80,
                clip={
                    "x": 0,
                    "y": 0,
                    "width": self._settings.viewport_width,
                    "height": self._settings.viewport_height,
                },
            )
            return full_path
        except Exception:  # noqa: BLE001
            logger.exception("screenshot_failed", extra={"lead_id": lead_id})
            return None

    async def _is_mobile_friendly(self, context, url: str) -> Optional[bool]:
        """Heurística: si en viewport 375x667 no aparece scroll horizontal y
        el meta viewport está presente, lo consideramos mobile friendly."""

        mobile_page = await context.new_page()
        try:
            await mobile_page.set_viewport_size({"width": 375, "height": 667})
            await mobile_page.goto(url, wait_until="domcontentloaded", timeout=self._settings.nav_timeout_ms)
            has_meta = await mobile_page.evaluate(
                """() => !!document.querySelector('meta[name="viewport"]')"""
            )
            overflow = await mobile_page.evaluate(
                """() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4"""
            )
            return bool(has_meta) and not bool(overflow)
        except Exception:  # noqa: BLE001
            return None
        finally:
            await mobile_page.close()
