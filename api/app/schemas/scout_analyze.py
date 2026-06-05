"""Schemas para análisis manual de URL vía Scout."""

from __future__ import annotations

from typing import Optional

from pydantic import AnyHttpUrl, BaseModel, Field


class AnalyzeUrlRequest(BaseModel):
    url: AnyHttpUrl
    location: Optional[str] = Field(default=None, description="País objetivo (ej. República Dominicana)")
    industry: Optional[str] = Field(default=None, description="Industria del negocio")


class AnalyzeUrlResponse(BaseModel):
    success: bool
    published: bool
    message: str
    url: str
    segment: Optional[str] = None
    total_score: Optional[int] = None
    problem_score: Optional[int] = None
    commercial_score: Optional[int] = None
    skipped_reason: Optional[str] = None
    reasons: list[str] = Field(default_factory=list)
