#!/usr/bin/env python3
"""Aplica parches incrementales cuando la BD se creó con schema.sql sin Alembic."""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.core.database import get_engine

PATCHES = [
    "ALTER TABLE sales_intelligence ADD COLUMN IF NOT EXISTS extras JSONB NOT NULL DEFAULT '{}'::jsonb",
    """
    ALTER TABLE outreach_messages
    ADD COLUMN IF NOT EXISTS has_attachment BOOLEAN NOT NULL DEFAULT false
    """,
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'outreach_messages' AND column_name = 'report_id'
        ) THEN
            ALTER TABLE outreach_messages
            ADD COLUMN report_id UUID REFERENCES reports(id) ON DELETE SET NULL;
        END IF;
    END $$
    """,
    """
    CREATE TABLE IF NOT EXISTS follow_up_sequences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        sequence_name VARCHAR(100) NOT NULL,
        step_number INTEGER NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL,
        sent_at TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        include_pdf BOOLEAN NOT NULL DEFAULT false,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_follow_up_sequences_lead_id ON follow_up_sequences (lead_id)",
    "CREATE INDEX IF NOT EXISTS ix_follow_up_sequences_scheduled_at ON follow_up_sequences (scheduled_at)",
    "CREATE INDEX IF NOT EXISTS ix_follow_up_sequences_status ON follow_up_sequences (status)",
]


async def main() -> None:
    engine = get_engine()
    async with engine.begin() as conn:
        for sql in PATCHES:
            await conn.execute(text(sql))
    print(f"Applied {len(PATCHES)} schema patches.")


if __name__ == "__main__":
    asyncio.run(main())
