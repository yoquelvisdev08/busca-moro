"""Rotación de User-Agents y proxies para Playwright."""

from __future__ import annotations

import random
from pathlib import Path
from typing import Iterable, Optional


class Rotator:
    """Selección aleatoria thread-safe de UA y proxies."""

    def __init__(self, user_agents: Iterable[str], proxies: Iterable[str]) -> None:
        self._user_agents = [ua for ua in user_agents if ua.strip()]
        self._proxies = [p for p in proxies if p.strip()]
        if not self._user_agents:
            self._user_agents = [
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
            ]

    @classmethod
    def from_files(cls, ua_path: str, proxies_csv: Optional[str]) -> "Rotator":
        ua_file = Path(ua_path)
        uas = ua_file.read_text(encoding="utf-8").splitlines() if ua_file.exists() else []
        proxies = [p.strip() for p in (proxies_csv or "").split(",") if p.strip()]
        return cls(user_agents=uas, proxies=proxies)

    def pick_user_agent(self) -> str:
        return random.choice(self._user_agents)

    def pick_proxy(self) -> Optional[str]:
        if not self._proxies:
            return None
        return random.choice(self._proxies)
