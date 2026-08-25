"""custom shelves

Two new tables and nothing touched: a shelf is a name plus an ordered set of
entries, and no existing row changes meaning. Every account starts with no shelves,
which is also what the UI renders as "none yet", so upgrading changes nothing about
how an instance behaves until someone makes one.

Deliberately no seeded defaults. "Favorites" and friends are names the client
suggests when creating a shelf, not rows written into every account on upgrade --
a backfill would put empty shelves nobody asked for on every existing user.

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-25
"""

import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shelves",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("description", sa.String(280), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("user_id", "name", name="uq_shelf_user_name"),
    )
    op.create_index("ix_shelves_user_id", "shelves", ["user_id"])

    op.create_table(
        "shelf_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "shelf_id",
            sa.Integer(),
            sa.ForeignKey("shelves.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "list_entry_id",
            sa.Integer(),
            sa.ForeignKey("list_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "added_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("shelf_id", "list_entry_id", name="uq_shelf_item"),
    )
    op.create_index("ix_shelf_items_shelf_id", "shelf_items", ["shelf_id"])
    op.create_index("ix_shelf_items_list_entry_id", "shelf_items", ["list_entry_id"])


def downgrade() -> None:
    # Dropping these loses every shelf anyone made, and upgrading again cannot bring
    # them back. Nothing else in the schema depends on them, so a downgrade is only
    # ever a deliberate "remove the feature".
    op.drop_table("shelf_items")
    op.drop_table("shelves")
