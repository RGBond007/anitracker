"""spoiler protection

Two boolean columns, both with server defaults, so every existing row is valid
the moment the column exists and no backfill runs.

`users.spoiler_protection` defaults to **true**, which does change behaviour for
existing accounts on upgrade: seasons past the one you are on start asking before
they open, and a friend's message can arrive covered. That direction is deliberate
-- protection nobody wanted costs one tap to undo, and protection somebody wanted
but did not get costs them the story. It is a single switch in Settings.

`friend_recommendations.has_spoilers` defaults to false, which is what every
message sent before this existed effectively claimed.

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-26
"""

import sqlalchemy as sa

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("spoiler_protection", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "friend_recommendations",
        sa.Column("has_spoilers", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("friend_recommendations", "has_spoilers")
    op.drop_column("users", "spoiler_protection")
