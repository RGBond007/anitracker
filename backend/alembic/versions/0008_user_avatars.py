"""uploaded profile pictures

One nullable column holding the generated filename of a user's avatar. NULL means
"no picture uploaded", which is what every existing account gets and what the
initials fallback already renders, so no backfill is needed and no account changes
behaviour on upgrade.

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-18
"""

import sqlalchemy as sa

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_filename", sa.String(64), nullable=True))


def downgrade() -> None:
    # The files themselves are left alone: a downgrade that deleted everyone's
    # uploads could not be undone by upgrading again.
    op.drop_column("users", "avatar_filename")
