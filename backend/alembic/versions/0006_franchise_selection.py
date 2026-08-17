"""remember which season of a series the user is on

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-17
"""

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "franchise_selections",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("root_provider_id", sa.String(64), nullable=False),
        sa.Column(
            "media_cache_id",
            sa.Integer,
            sa.ForeignKey("media_cache.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "root_provider_id", name="uq_selection_user_root"),
    )
    op.create_index("ix_franchise_selections_user_id", "franchise_selections", ["user_id"])
    op.create_index(
        "ix_franchise_selections_root_provider_id", "franchise_selections", ["root_provider_id"]
    )
    op.create_index(
        "ix_franchise_selections_media_cache_id", "franchise_selections", ["media_cache_id"]
    )


def downgrade() -> None:
    op.drop_table("franchise_selections")
