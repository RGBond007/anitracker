"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-08-10
"""

import sqlalchemy as sa

from alembic import op
from app.types import StringArray

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

role = sa.Enum("admin", "user", name="role")
title_language = sa.Enum("romaji", "english", "native", name="title_language")
media_type = sa.Enum("anime", "manga", name="media_type")
entry_status = sa.Enum("current", "completed", "on_hold", "dropped", "planned", name="entry_status")
import_state = sa.Enum("pending", "running", "done", "failed", name="import_state")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", role, nullable=False, server_default="user"),
        sa.Column("title_language", title_language, nullable=False, server_default="romaji"),
        sa.Column("ui_language", sa.String(8), nullable=False, server_default="en"),
        sa.Column("theme", sa.String(16), nullable=False, server_default="dark"),
        sa.Column("token_version", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "media_cache",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_id", sa.String(64), nullable=False),
        sa.Column("mal_id", sa.Integer, nullable=True),
        sa.Column("type", media_type, nullable=False),
        sa.Column("title_romaji", sa.String(512)),
        sa.Column("title_english", sa.String(512)),
        sa.Column("title_native", sa.String(512)),
        sa.Column("synonyms", StringArray),
        sa.Column("cover_url", sa.String(1024)),
        sa.Column("cover_color", sa.String(16)),
        sa.Column("banner_url", sa.String(1024)),
        sa.Column("synopsis", sa.Text),
        sa.Column("total_units", sa.Integer),
        sa.Column("format", sa.String(32)),
        sa.Column("status", sa.String(32)),
        sa.Column("season_year", sa.Integer),
        sa.Column("genres", StringArray),
        sa.Column("average_score", sa.Integer),
        sa.Column("duration", sa.Integer),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("provider", "provider_id", name="uq_media_provider"),
    )
    op.create_index("ix_media_cache_provider", "media_cache", ["provider"])
    op.create_index("ix_media_cache_provider_id", "media_cache", ["provider_id"])
    op.create_index("ix_media_cache_mal_id", "media_cache", ["mal_id"])
    op.create_index("ix_media_cache_type", "media_cache", ["type"])

    op.create_table(
        "list_entries",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "media_cache_id",
            sa.Integer,
            sa.ForeignKey("media_cache.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", entry_status, nullable=False),
        sa.Column("score", sa.Integer),
        sa.Column("progress", sa.Integer, nullable=False, server_default="0"),
        sa.Column("rewatch_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("start_date", sa.Date),
        sa.Column("finish_date", sa.Date),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "media_cache_id", name="uq_entry_user_media"),
    )
    op.create_index("ix_list_entries_user_id", "list_entries", ["user_id"])
    op.create_index("ix_list_entries_media_cache_id", "list_entries", ["media_cache_id"])
    op.create_index("ix_list_entries_status", "list_entries", ["status"])

    # v2 hook -- table shipped in v1 so adding per-locale titles is not a migration risk later.
    op.create_table(
        "title_overrides",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "media_cache_id",
            sa.Integer,
            sa.ForeignKey("media_cache.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("locale", sa.String(16), nullable=False),
        sa.Column("custom_title", sa.String(512), nullable=False),
        sa.UniqueConstraint("media_cache_id", "locale", name="uq_override_media_locale"),
    )
    op.create_index("ix_title_overrides_media_cache_id", "title_overrides", ["media_cache_id"])

    op.create_table(
        "import_jobs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("source", sa.String(32), nullable=False, server_default="mal_xml"),
        sa.Column("state", import_state, nullable=False, server_default="pending"),
        sa.Column("total", sa.Integer, nullable=False, server_default="0"),
        sa.Column("processed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("imported", sa.Integer, nullable=False, server_default="0"),
        sa.Column("skipped", sa.Integer, nullable=False, server_default="0"),
        sa.Column("failed", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_import_jobs_user_id", "import_jobs", ["user_id"])


def downgrade() -> None:
    op.drop_table("import_jobs")
    op.drop_table("title_overrides")
    op.drop_table("list_entries")
    op.drop_table("media_cache")
    op.drop_table("users")
    bind = op.get_bind()
    for enum in (import_state, entry_status, media_type, title_language, role):
        enum.drop(bind, checkfirst=True)
