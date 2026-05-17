"""Pydantic schemas para SenderProfile."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SenderProfileCreate(BaseModel):
    name: str
    title: Optional[str] = None
    company: Optional[str] = None
    website: str = "https://yoquelvis.dev"
    bio: Optional[str] = None
    services: list[str] = Field(default_factory=list)
    tech_stack: list[str] = Field(default_factory=list)
    tone: str = "consultivo"
    email_signature: str = ""


class SenderProfileUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    bio: Optional[str] = None
    services: Optional[list[str]] = None
    tech_stack: Optional[list[str]] = None
    tone: Optional[str] = None
    email_signature: Optional[str] = None
    is_active: Optional[bool] = None


class SenderProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    title: Optional[str]
    company: Optional[str]
    website: str
    bio: Optional[str]
    services: list[str]
    tech_stack: list[str]
    tone: str
    email_signature: str
    is_active: bool
    scraped_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class SenderProfileScrapeResult(BaseModel):
    success: bool
    message: str
    profile: Optional[SenderProfileRead] = None
