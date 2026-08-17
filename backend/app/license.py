"""License validation stub.

AniTracker v1 is open source and unlicensed-by-key: this validator always returns a
valid, unrestricted result. It exists so that gating a future paid tier is a
config + implementation change *here* rather than a refactor of the app.

Contract for a future implementation:
  * ``validate()`` is called once at startup and its result cached on app state.
  * Returning ``valid=False`` must never crash the app -- callers degrade, not die.
  * ``features`` is the set of flags the rest of the app may check.
"""

from dataclasses import dataclass, field

from app.config import settings

ALL_FEATURES = frozenset({"multi_user", "import", "share_links"})


@dataclass(frozen=True)
class LicenseInfo:
    valid: bool = True
    tier: str = "community"
    holder: str | None = None
    features: frozenset[str] = field(default_factory=lambda: ALL_FEATURES)

    def has(self, feature: str) -> bool:
        return feature in self.features


def validate(key: str | None = None) -> LicenseInfo:
    key = settings.license_key if key is None else key
    if not key:
        return LicenseInfo()
    # No-op: any key is accepted and grants everything. Replace with real
    # signature verification when a paid tier ships.
    return LicenseInfo(tier="licensed", holder=None)
