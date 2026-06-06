"""Factory de páginas Playwright con stealth + UA/proxy rotados."""

from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import urlparse

from playwright.async_api import Browser, BrowserContext, Page
from playwright_stealth import stealth_async

logger = logging.getLogger(__name__)


async def new_stealth_context(
    browser: Browser,
    *,
    user_agent: str,
    viewport_width: int,
    viewport_height: int,
    proxy: Optional[str] = None,
    locale: str = "es-ES",
) -> BrowserContext:
    """Crea un contexto aislado con UA, locale y (opcional) proxy.

    Notas:
        * El proxy a nivel de contexto solo funciona si el browser fue lanzado
          sin proxy; cuando exista pool, configurar a nivel de ``launch`` con
          ``proxy={"server": "..."}``.
        * ``stealth_async`` parchea ``navigator.webdriver``, plugins, WebGL,
          etc.
    """

    context_kwargs: dict = {
        "user_agent": user_agent,
        "viewport": {"width": viewport_width, "height": viewport_height},
        "locale": locale,
        "ignore_https_errors": True,
        "java_script_enabled": True,
    }

    if proxy:
        parsed = urlparse(proxy)
        server = f"{parsed.scheme}://{parsed.hostname}:{parsed.port}" if parsed.scheme else proxy
        context_kwargs["proxy"] = {"server": server}
        if parsed.username:
            context_kwargs["proxy"]["username"] = parsed.username
        if parsed.password:
            context_kwargs["proxy"]["password"] = parsed.password

    context = await browser.new_context(**context_kwargs)
    await context.add_init_script(
        """
        Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        window.chrome = { runtime: {} };
        """
    )
    return context


async def apply_stealth(page: Page) -> None:
    await stealth_async(page)
