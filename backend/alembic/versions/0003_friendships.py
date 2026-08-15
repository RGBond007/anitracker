"""friendships and per-user profile visibility

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-10
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Created explicitly so a re-run is idempotent; the column below then reuses it
    # with `create_type=False`, or create_table would emit a second CREATE TYPE and
    # fail with DuplicateObjectError.
    sa.Enum("pending", "accepted", "blocked", name="friendship_state").create(
        op.get_bind(), checkfirst=True
    )
    friendship_state = postgresql.ENUM(
        "pending", "accepted", "blocked", name="friendship_state", create_type=False
    )

    op.create_table(
        "friendships",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "requester_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "addressee_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("state", friendship_state, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("requester_id", "addressee_id", name="uq_friendship_pair"),
        sa.CheckConstraint("requester_id <> addressee_id", name="ck_friendship_not_self"),
    )
    op.create_index("ix_friendships_requester_id", "friendships", ["requester_id"])
    op.create_index("ix_friendships_addressee_id", "friendships", ["addressee_id"])
    op.create_index("ix_friendships_state", "friendships", ["state"])

    # Existing users keep their lists private; opting in is a deliberate act.
    op.add_column(
        "users",
        sa.Column(
            "profile_public",
            sa.Boolean,
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "profile_public")
    op.drop_index("ix_friendships_state", table_name="friendships")
    op.drop_index("ix_friendships_addressee_id", table_name="friendships")
    op.drop_index("ix_friendships_requester_id", table_name="friendships")
    op.drop_table("friendships")
    sa.Enum(name="friendship_state").drop(op.get_bind(), checkfirst=True)
