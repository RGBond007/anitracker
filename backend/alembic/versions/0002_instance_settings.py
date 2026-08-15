"""admin-editable instance settings

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-10
"""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Single row (id=1). NULL means "use the .env value".
    op.create_table(
        "instance_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("instance_name", sa.String(64)),
        sa.Column("logo_url", sa.String(1024)),
        sa.Column("accent_color", sa.String(32)),
        sa.Column("allow_signup", sa.Boolean),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("instance_settings")
