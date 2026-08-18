from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Core ---
    database_url: str = "postgresql+asyncpg://anitrack:anitrack@db:5432/anitrack"
    jwt_secret: str = "change-me-in-production"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    cookie_secure: bool = False  # set true behind HTTPS

    # --- Instance policy ---
    allow_signup: bool = True

    # --- Rate limiting ---
    rate_limit_enabled: bool = True
    # Only enable behind a proxy you control. When true, `X-Forwarded-For` decides
    # who a request is attributed to — and any client can forge that header, so on
    # a directly-exposed instance this hands out a free bypass.
    trust_proxy: bool = False

    # --- Branding (white-label hooks) ---
    instance_name: str = "AniTracker"
    logo_url: str = ""
    accent_color: str = "#8b5cf6"

    # --- Uploads ---
    # Where user-uploaded files live. A directory rather than the database: an
    # avatar is served straight off disk on every page, and the compose file backs
    # it with a named volume so it survives `up -d --build` like the database does.
    # The default is relative so a checkout runs without root-owned paths; the
    # container sets it to the mounted volume.
    media_root: str = "data/media"
    max_avatar_bytes: int = 5 * 1024 * 1024
    #: Every stored avatar is re-encoded to this square, so one size serves every
    #: place one is drawn and nothing on the page depends on what was uploaded.
    avatar_pixels: int = 512

    # --- Licensing (no-op stub; see app/license.py) ---
    license_key: str = ""

    # --- Providers ---
    media_cache_ttl_days: int = 7
    search_cache_ttl_seconds: int = 600
    provider_order: str = "anilist,jikan,kitsu"

    @property
    def providers(self) -> list[str]:
        return [p.strip() for p in self.provider_order.split(",") if p.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
