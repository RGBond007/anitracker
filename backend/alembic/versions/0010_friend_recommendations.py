"""recommendations sent between friends

One new table, nothing existing touched. Every account starts with an empty inbox,
which is what the UI already renders as "nothing here", so an upgraded instance
behaves exactly as it did until someone sends one.

Two enums, handled differently on purpose. `recommendation_state` is new, so it is
created explicitly and the column then references it with `create_type=False`.
`media_type` already exists from 0001, and this is the trap: a plain `sa.Enum` in a
column definition emits `CREATE TYPE` on Postgres, which fails with "type
media_type already exists" the moment a second table wants it. Only
`postgresql.ENUM(..., create_type=False)` says "use the one that is already there".

SQLite has no enum types at all, so neither problem exists there and the dialect
check below is what keeps one file correct for both.

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-25
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

STATES = ("pending", "viewed", "accepted", "dismissed")


def _enum(bind, *values: str, name: str):
    """
    A column type that reuses an existing Postgres enum instead of redefining it.

    `sa.Enum` carries "create the type" with it; `postgresql.ENUM(create_type=False)`
    does not. On SQLite both render as VARCHAR with a check constraint, so the plain
    one is right there.
    """
    if bind.dialect.name == "postgresql":
        return postgresql.ENUM(*values, name=name, create_type=False)
    return sa.Enum(*values, name=name)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        postgresql.ENUM(*STATES, name="recommendation_state", create_type=False).create(
            bind, checkfirst=True
        )

    op.create_table(
        "friend_recommendations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "sender_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "recipient_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_id", sa.String(64), nullable=False),
        sa.Column("media_type", _enum(bind, "anime", "manga", name="media_type"), nullable=False),
        sa.Column("message", sa.String(280), nullable=True),
        sa.Column(
            "state",
            _enum(bind, *STATES, name="recommendation_state"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("sender_id <> recipient_id", name="ck_recommendation_not_self"),
    )
    op.create_index("ix_friend_recommendations_sender_id", "friend_recommendations", ["sender_id"])
    op.create_index(
        "ix_friend_recommendations_recipient_id", "friend_recommendations", ["recipient_id"]
    )
    op.create_index(
        "ix_friend_recommendations_provider_id", "friend_recommendations", ["provider_id"]
    )
    op.create_index("ix_friend_recommendations_state", "friend_recommendations", ["state"])

    # "One pending recommendation per title per pair" is enforced in the router so it
    # can answer with a 409 the client can act on. This index is what makes that
    # check a lookup rather than a scan of the sender's history.
    op.create_index(
        "ix_friend_recommendations_dedupe",
        "friend_recommendations",
        ["recipient_id", "sender_id", "provider", "provider_id", "state"],
    )


def downgrade() -> None:
    op.drop_table("friend_recommendations")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        postgresql.ENUM(name="recommendation_state").drop(bind, checkfirst=True)
