"""Pytest — paths para Orion API + dominio Poseidon."""

from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_ORION_API = _REPO_ROOT / "orion" / "api"
_POSEIDON_PKG = _REPO_ROOT / "poseidon"

for path in (_ORION_API, _POSEIDON_PKG):
    text = str(path)
    if text not in sys.path:
        sys.path.insert(0, text)
