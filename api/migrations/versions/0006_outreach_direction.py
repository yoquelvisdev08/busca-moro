"""Add direction to outreach_messages (outbound / inbound)."""

from alembic import op
import sqlalchemy as sa

revision = "0006_outreach_direction"
down_revision = "0005_lead_delete_reason"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "outreach_messages",
        sa.Column(
            "direction",
            sa.String(length=16),
            nullable=False,
            server_default="outbound",
        ),
    )
    op.create_index(
        "idx_outreach_direction",
        "outreach_messages",
        ["direction"],
    )


def downgrade() -> None:
    op.drop_index("idx_outreach_direction", table_name="outreach_messages")
    op.drop_column("outreach_messages", "direction")
