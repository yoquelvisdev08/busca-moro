"""Add follow_up_sequences table and outreach_message attachment fields

Revision ID: 0003_add_follow_ups
Revises: 0002_add_reports
Create Date: 2026-05-28

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003_add_follow_ups"
down_revision: Union[str, None] = "0002_add_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Add attachment fields to outreach_messages
    # ------------------------------------------------------------------
    op.add_column(
        "outreach_messages",
        sa.Column(
            "has_attachment",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "outreach_messages",
        sa.Column(
            "report_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reports.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # ------------------------------------------------------------------
    # 2. Create follow_up_sequences table
    # ------------------------------------------------------------------
    op.create_table(
        "follow_up_sequences",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "lead_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sequence_name", sa.String(100), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column(
            "scheduled_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "include_pdf",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "retry_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Indexes
    op.create_index("ix_follow_up_sequences_lead_id", "follow_up_sequences", ["lead_id"])
    op.create_index("ix_follow_up_sequences_scheduled_at", "follow_up_sequences", ["scheduled_at"])
    op.create_index("ix_follow_up_sequences_status", "follow_up_sequences", ["status"])


def downgrade() -> None:
    # Drop indexes
    op.drop_index("ix_follow_up_sequences_status", table_name="follow_up_sequences")
    op.drop_index("ix_follow_up_sequences_scheduled_at", table_name="follow_up_sequences")
    op.drop_index("ix_follow_up_sequences_lead_id", table_name="follow_up_sequences")

    # Drop table
    op.drop_table("follow_up_sequences")

    # Remove attachment columns from outreach_messages
    op.drop_column("outreach_messages", "report_id")
    op.drop_column("outreach_messages", "has_attachment")
