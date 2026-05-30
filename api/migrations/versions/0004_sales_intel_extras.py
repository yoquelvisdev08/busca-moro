"""Add extras JSONB to sales_intelligence for brief, alt emails, report narrative."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_sales_intel_extras"
down_revision = "0003_add_follow_ups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_intelligence",
        sa.Column(
            "extras",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
    )


def downgrade() -> None:
    op.drop_column("sales_intelligence", "extras")
