"""movies, OVAs and specials as part of a series, in release order

Adds what a series page needs beyond its numbered spine: the ids of a title's
extras, what each member *is* within the series, and a real date to order them by.

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-17
"""

import sqlalchemy as sa

from alembic import op
from app.types import StringArray

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # `StringArray`, exactly as `synonyms` and `genres` are declared: it resolves to
    # `text[]` on Postgres and JSON on SQLite, so the column the model expects is the
    # column the migration creates on both. A plain `sa.JSON` here would build a
    # `json` column that Postgres then refuses to read back as an array.
    op.add_column("media_cache", sa.Column("related_ids", StringArray))
    op.add_column("media_cache", sa.Column("parent_id", sa.String(64), nullable=True))
    op.add_column("media_cache", sa.Column("kind", sa.String(16), nullable=True))
    op.add_column("media_cache", sa.Column("start_date", sa.Date, nullable=True))

    # Deliberately no backfill. Every already-grouped row is a numbered season, so
    # `kind = 'season'` would be correct -- and would also destroy the one signal
    # that says "this row was cached before extras existed, and its `related_ids` are
    # unknown rather than empty". `season_chain._refresh_links` reads a NULL `kind`
    # on a grouped row as exactly that and re-fetches it once, which is how existing
    # libraries pick up their movies and OVAs.


def downgrade() -> None:
    op.drop_column("media_cache", "start_date")
    op.drop_column("media_cache", "kind")
    op.drop_column("media_cache", "related_ids")
    op.drop_column("media_cache", "parent_id")
