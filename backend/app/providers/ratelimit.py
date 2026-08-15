import asyncio
import time


class TokenBucket:
    """Async token bucket, one per provider.

    ``rate`` tokens are added per second up to ``capacity``. ``acquire()`` waits
    until a token is available, so callers never need to think about pacing.
    """

    def __init__(self, rate: float, capacity: float):
        self.rate = rate
        self.capacity = capacity
        self._tokens = capacity
        self._updated = time.monotonic()
        self._lock = asyncio.Lock()
        self._blocked_until = 0.0

    def penalise(self, seconds: float) -> None:
        """Called on a 429 -- hard-stop this provider for a while."""
        self._blocked_until = max(self._blocked_until, time.monotonic() + seconds)

    @property
    def blocked(self) -> bool:
        return time.monotonic() < self._blocked_until

    async def acquire(self, tokens: float = 1.0) -> None:
        while True:
            async with self._lock:
                now = time.monotonic()
                if now < self._blocked_until:
                    wait = self._blocked_until - now
                else:
                    self._tokens = min(
                        self.capacity, self._tokens + (now - self._updated) * self.rate
                    )
                    self._updated = now
                    if self._tokens >= tokens:
                        self._tokens -= tokens
                        return
                    wait = (tokens - self._tokens) / self.rate
            await asyncio.sleep(min(wait, 5.0))
