"""Add commercial next-step fields to leads."""

from alembic import op
import sqlalchemy as sa

revision = "0007_lead_next_step"
down_revision = "0006_outreach_direction"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("next_step_type", sa.String(length=32), nullable=True))
    op.add_column(
        "leads",
        sa.Column("next_step_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("leads", sa.Column("next_step_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("leads", "next_step_notes")
    op.drop_column("leads", "next_step_at")
    op.drop_column("leads", "next_step_type")
