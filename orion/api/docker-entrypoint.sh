#!/bin/sh
set -e

# Solo migraciones (deploy: docker compose run --rm api alembic upgrade head)
if [ "$1" = "alembic" ]; then
  shift
  exec alembic "$@"
fi

echo "Running database migrations..."
if ! alembic upgrade head; then
  echo "Alembic upgrade failed (schema.sql bootstrap?). Stamping head and applying patches..."
  alembic stamp head || true
  PYTHONPATH=/app python /app/scripts/patch_db_schema.py 2>/dev/null || \
    PYTHONPATH=/app python - <<'PY'
import asyncio
from sqlalchemy import text
from app.core.database import get_engine

PATCHES = [
    "ALTER TABLE sales_intelligence ADD COLUMN IF NOT EXISTS extras JSONB NOT NULL DEFAULT '{}'::jsonb",
    "ALTER TABLE outreach_messages ADD COLUMN IF NOT EXISTS has_attachment BOOLEAN NOT NULL DEFAULT false",
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

async def run():
    engine = get_engine()
    async with engine.begin() as conn:
        for sql in PATCHES:
            await conn.execute(text(sql))

asyncio.run(run())
print("Schema patches applied.")
PY
fi

if [ $# -gt 0 ]; then
  exec "$@"
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
