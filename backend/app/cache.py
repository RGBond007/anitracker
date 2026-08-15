import asyncio
import time
from typing import Any


class TTLCache:
    """Tiny in-process TTL cache.

    Deliberately not Redis: v1 is a single backend container, and an extra service
    would cost more than it buys. Swap the implementation here if that changes.
    """

    def __init__(self, ttl: float, max_size: int = 512):
        self.ttl = ttl
        self.max_size = max_size
        self._data: dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            hit = self._data.get(key)
            if not hit:
                return None
            expires, value = hit
            if expires < time.monotonic():
                self._data.pop(key, None)
                return None
            return value

    async def set(self, key: str, value: Any) -> None:
        async with self._lock:
            if len(self._data) >= self.max_size:
                # Cheap eviction: drop the oldest-inserted quarter.
                for stale in list(self._data)[: self.max_size // 4]:
                    self._data.pop(stale, None)
            self._data[key] = (time.monotonic() + self.ttl, value)

    async def clear(self) -> None:
        async with self._lock:
            self._data.clear()
