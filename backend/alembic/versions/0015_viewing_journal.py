"""per-episode viewing journal

One new table. Nothing existing is touched, and in particular `list_entries.notes`
is left exactly as it is: the journal sits beside the general note rather than
replacing it, because a scratchpad for a whole title and a series of dated moments
are not the same thing.

The `mood` enum is new and is created explicitly on Postgres before the column
references it -- the same shape as 0010 to 0012.

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-26
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None

MOODS = ("loved", "moved", "tense", "funny", "lost", "dull")


def _enum(bind, *values: str, name: str):
    if bind.dialect.name == "postgresql":
        return postgresql.ENUM(*values, name=name, create_type=False)
    return sa.Enum(*values, name=name)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        postgresql.ENUM(*MOODS, name="mood", create_type=False).create(bind, checkfirst=True)

    op.create_table(
        "journal_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "list_entry_id",
            sa.Integer(),
            sa.ForeignKey("list_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("unit", sa.Integer(), nullable=False),
        sa.Column("rewatch_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("note", sa.String(1000), nullable=True),
        sa.Column("mood", _enum(bind, *MOODS, name="mood"), nullable=True),
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("has_spoilers", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint(
            "list_entry_id", "unit", "rewatch_index", name="uq_journal_entry_unit_pass"
        ),
        sa.CheckConstraint("unit >= 1", name="ck_journal_unit_positive"),
    )
    op.create_index("ix_journal_entries_user_id", "journal_entries", ["user_id"])
    op.create_index("ix_journal_entries_list_entry_id", "journal_entries", ["list_entry_id"])
    # The timeline reads newest-first for one person; this is the index it uses.
    op.create_index("ix_journal_entries_user_created", "journal_entries", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_table("journal_entries")
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        postgresql.ENUM(name="mood").drop(bind, checkfirst=True)
