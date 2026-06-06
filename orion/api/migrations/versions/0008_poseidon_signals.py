"""Poseidon intent signals inbox."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0008_poseidon_signals"
down_revision = "0007_lead_next_step"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poseidon_signal_status') THEN
                CREATE TYPE poseidon_signal_status AS ENUM (
                    'new',
                    'reviewed',
                    'contacted',
                    'dismissed',
                    'converted'
                );
            END IF;
        END$$;
        """
    )

    poseidon_status = postgresql.ENUM(
        "new",
        "reviewed",
        "contacted",
        "dismissed",
        "converted",
        name="poseidon_signal_status",
        create_type=False,
    )

    op.create_table(
        "poseidon_signals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("platform", sa.String(length=64), nullable=False, server_default="other"),
        sa.Column("title", sa.Text(), nullable=False, server_default=""),
        sa.Column("snippet", sa.Text(), nullable=False, server_default=""),
        sa.Column("author_hint", sa.Text(), nullable=True),
        sa.Column("intent_category", sa.String(length=32), nullable=False, server_default="general"),
        sa.Column("intent_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("keyword_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("llm_score", sa.Integer(), nullable=True),
        sa.Column("query_used", sa.Text(), nullable=True),
        sa.Column(
            "status",
            poseidon_status,
            nullable=False,
            server_default="new",
        ),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leads.id", ondelete="SET NULL"), nullable=True),
        sa.Column("llm_summary", sa.Text(), nullable=True),
        sa.Column("reply_angle", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("raw_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("source_url", name="uq_poseidon_signals_source_url"),
    )
    op.create_index("idx_poseidon_signals_status", "poseidon_signals", ["status"])
    op.create_index("idx_poseidon_signals_intent_score", "poseidon_signals", ["intent_score"])
    op.create_index("idx_poseidon_signals_detected_at", "poseidon_signals", ["detected_at"])


def downgrade() -> None:
    op.drop_index("idx_poseidon_signals_detected_at", table_name="poseidon_signals")
    op.drop_index("idx_poseidon_signals_intent_score", table_name="poseidon_signals")
    op.drop_index("idx_poseidon_signals_status", table_name="poseidon_signals")
    op.drop_table("poseidon_signals")
    op.execute("DROP TYPE IF EXISTS poseidon_signal_status")
