"""one-time passwords for admin-created accounts

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-11
"""

import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing accounts chose their own password, so none of them are pending.
    op.add_column(
        "users",
        sa.Column(
            "must_change_password",
            sa.Boolean,
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "must_change_password")
