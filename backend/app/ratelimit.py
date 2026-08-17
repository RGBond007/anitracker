"""
In-process rate limiting.

State lives in this process's memory, which is the right scope for the way
AniTracker ships: one uvicorn worker in one container. Run it behind `--workers N`
and each worker keeps its own counters, so the effective limit multiplies by N —
if you scale that way, move `_HITS` to Redis and keep the rest of this module.

The window is a sliding log rather than a fixed counter: a fixed window lets an
attacker send `limit` requests at 0:59 and `limit` more at 1:01, which is double
the intended rate at the moment it matters most.
"""

import time
from collections import defaultdict, deque
from typing import Literal

from fastapi import Depends, HTTPException, Request, status

from app.config import settings

# bucket key -> timestamps of recent hits, oldest first
_HITS: dict[str, deque[float]] = defaultdict(deque)

# Sweeping every request would be O(buckets) per call; this keeps it amortised.
_SWEEP_EVERY = 512
_since_sweep = 0
_LONGEST_WINDOW = 3600.0


def _sweep(now: float) -> None:
    """Drop buckets no longer holding a live hit, so idle clients are not retained."""
    for key in [k for k, hits in _HITS.items() if not hits or now - hits[-1] > _LONGEST_WINDOW]:
        del _HITS[key]


def client_ip(request: Request) -> str:
    """
    The address to attribute a request to.

    `X-Forwarded-For` is only honoured when `trust_proxy` is set, because any
    client can send that header: trusting it unconditionally would let one
    attacker present a fresh identity per request and bypass every limit here.
    """
    if settings.trust_proxy:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            # Left-most entry is the original client; the rest are proxies.
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimit:
    """
    A dependency that allows `limit` requests per `window` seconds.

    `scope="ip"` buckets by caller address — the right choice for endpoints that
    can be reached before authenticating. `scope="user"` buckets by account, so
    one member of a shared household cannot exhaust everyone else's budget.
    """

    def __init__(
        self,
        name: str,
        limit: int,
        window: int,
        scope: Literal["ip", "user"] = "ip",
    ) -> None:
        self.name = name
        self.limit = limit
        self.window = float(window)
        self.scope = scope

    async def __call__(self, request: Request) -> None:
        if not settings.rate_limit_enabled:
            return

        global _since_sweep
        now = time.monotonic()

        _since_sweep += 1
        if _since_sweep >= _SWEEP_EVERY:
            _since_sweep = 0
            _sweep(now)

        identity = client_ip(request)
        if self.scope == "user":
            # Set by `current_user`; falls back to address for unauthenticated hits.
            identity = str(getattr(request.state, "user_id", None) or identity)

        hits = _HITS[f"{self.name}:{identity}"]
        cutoff = now - self.window
        while hits and hits[0] <= cutoff:
            hits.popleft()

        if len(hits) >= self.limit:
            retry_after = max(1, int(hits[0] + self.window - now) + 1)
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many requests. Try again shortly.",
                headers={"Retry-After": str(retry_after)},
            )

        hits.append(now)


def limit(name: str, times: int, seconds: int, scope: Literal["ip", "user"] = "ip"):
    """Sugar so routes read `dependencies=[limit("login", 10, 300)]`."""
    return Depends(RateLimit(name, times, seconds, scope))


def penalise(request: Request, name: str) -> None:
    """
    Record an extra hit against a bucket after the fact.

    Used for failed logins: a correct password should not spend the same budget as
    a wrong one, so the strict counter only advances when an attempt fails.
    """
    if not settings.rate_limit_enabled:
        return
    _HITS[f"{name}:{client_ip(request)}"].append(time.monotonic())


def reset() -> None:
    """Test hook — clears all buckets."""
    _HITS.clear()
