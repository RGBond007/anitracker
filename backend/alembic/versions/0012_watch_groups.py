"""watch-together groups

Two tables and nothing touched. Coordination only: a group holds a title, a
roster and an optional target episode. No progress is stored here -- each
member's position is read from their own list entry at request time, so the two
can never disagree.

`media_type` already exists from 0001, so it is referenced with
`postgresql.ENUM(create_type=False)` rather than a plain `sa.Enum`, which would
emit CREATE TYPE and fail. `watch_group_state` is new and is created explicitly.
This is the same shape as 0010 and 0011, and for the same reason.

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-25
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

STATES = ("invited", "joined", "left")


def _enum(bind, *values: str, name: str):
    """Reuse an existing Postgres type; never create one from a column definition."""
    if bind.dialect.name == "postgresql":
        return postgresql.ENUM(*values, name=name, create_type=False)
    return sa.Enum(*values, name=name)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        postgresql.ENUM(*STATES, name="watch_group_state", create_type=False).create(
            bind, checkfirst=True
        )

    op.create_table(
        "watch_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_id", sa.String(64), nullable=False),
        sa.Column("media_type", _enum(bind, "anime", "manga", name="media_type"), nullable=False),
        sa.Column("target_unit", sa.Integer(), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        # NULL never equals NULL, so this constrains nothing while a group is open
        # and is harmless once closed. The router enforces "one open group per
        # owner per title", which it can do with a message worth reading.
        sa.UniqueConstraint(
            "owner_id", "provider", "provider_id", "closed_at", name="uq_group_owner_title_open"
        ),
    )
    op.create_index("ix_watch_groups_owner_id", "watch_groups", ["owner_id"])
    op.create_index("ix_watch_groups_provider_id", "watch_groups", ["provider_id"])

    op.create_table(
        "watch_group_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("watch_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "state",
            _enum(bind, *STATES, name="watch_group_state"),
            nullable=False,
            server_default="invited",
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("group_id", "user_id", name="uq_group_member"),
    )
    op.create_index("ix_watch_group_members_group_id", "watch_group_members", ["group_id"])
    op.create_index("ix_watch_group_members_user_id", "watch_group_members", ["user_id"])
    op.create_index("ix_watch_group_members_state", "watch_group_members", ["state"])


def downgrade() -> None:
    op.drop_table("watch_group_members")
    op.drop_table("watch_groups")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        postgresql.ENUM(name="watch_group_state").drop(bind, checkfirst=True)
