"""season chains: link a show's seasons so the library can group them

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-15
"""

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media_cache", sa.Column("season", sa.String(16)))
    op.add_column("media_cache", sa.Column("prequel_id", sa.String(64)))
    op.add_column("media_cache", sa.Column("sequel_id", sa.String(64)))
    op.add_column("media_cache", sa.Column("root_provider_id", sa.String(64)))
    op.add_column("media_cache", sa.Column("season_number", sa.Integer))
    op.create_index("ix_media_cache_root_provider_id", "media_cache", ["root_provider_id"])
    # Existing rows keep NULLs; they are backfilled the next time the title is
    # fetched or a chain that touches them is resolved.


def downgrade() -> None:
    op.drop_index("ix_media_cache_root_provider_id", table_name="media_cache")
    for column in ("season_number", "root_provider_id", "sequel_id", "prequel_id", "season"):
        op.drop_column("media_cache", column)
