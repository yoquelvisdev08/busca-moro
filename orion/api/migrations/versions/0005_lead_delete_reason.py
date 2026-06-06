"""Add deleted_reason to leads for archive context."""

from alembic import op
import sqlalchemy as sa

revision = "0005_lead_delete_reason"
down_revision = "0004_sales_intel_extras"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("deleted_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("leads", "deleted_reason")
