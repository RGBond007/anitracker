"""shelf sharing and completion reactions

Two independent additions in one revision because they ship together.

`shelves.is_shared` defaults to false and every existing row gets that default, so
the upgrade cannot publish a shelf somebody made while shelves were private. That
is the whole point of the column: sharing is a decision, and no migration is
allowed to make it on the owner's behalf.

The `reaction` enum is new, so it is created explicitly on Postgres before the
column references it -- the same shape as 0010, and for the same reason: a plain
`sa.Enum` in a column definition emits CREATE TYPE, which is only correct for a
type that does not exist yet.

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-25
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None

REACTIONS = ("clapped", "same", "queued", "envious", "crying")


def _enum(bind, *values: str, name: str):
    """Reuse an existing Postgres type; create nothing from a column definition."""
    if bind.dialect.name == "postgresql":
        return postgresql.ENUM(*values, name=name, create_type=False)
    return sa.Enum(*values, name=name)


def upgrade() -> None:
    bind = op.get_bind()

    op.add_column(
        "shelves",
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    if bind.dialect.name == "postgresql":
        postgresql.ENUM(*REACTIONS, name="reaction", create_type=False).create(
            bind, checkfirst=True
        )

    op.create_table(
        "entry_reactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "entry_id",
            sa.Integer(),
            sa.ForeignKey("list_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("kind", _enum(bind, *REACTIONS, name="reaction"), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("entry_id", "user_id", name="uq_reaction_entry_user"),
    )
    op.create_index("ix_entry_reactions_entry_id", "entry_reactions", ["entry_id"])
    op.create_index("ix_entry_reactions_user_id", "entry_reactions", ["user_id"])


def downgrade() -> None:
    op.drop_table("entry_reactions")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        postgresql.ENUM(name="reaction").drop(bind, checkfirst=True)
    # Dropping this un-shares everything, which is the safe direction to fail in.
    op.drop_column("shelves", "is_shared")
