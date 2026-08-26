"""per-episode titles

One array column on the media cache, defaulting to empty. Nothing is backfilled:
titles arrive the next time a title's metadata is refetched, and until then every
episode simply shows its number, which is what the app did before this existed.

Coverage is genuinely partial. AniList returns these only where a streaming site
supplied them, and the other two providers do not return them at all -- so an
empty array is the ordinary answer for most titles and must never read as an
error.

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-26
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # Matches `app.types.StringArray`: native text[] on Postgres, JSON elsewhere.
    column = postgresql.ARRAY(sa.String()) if bind.dialect.name == "postgresql" else sa.JSON()
    op.add_column(
        "media_cache",
        sa.Column(
            "episode_titles",
            column,
            nullable=False,
            server_default="{}" if bind.dialect.name == "postgresql" else "[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("media_cache", "episode_titles")
