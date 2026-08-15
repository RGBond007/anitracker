"""MyAnimeList XML export parser.

MAL exports a gzipped XML file per list type (anime / manga). We accept either the
gzipped or the plain XML, and normalise both shapes into one ``MalEntry``.
"""

import gzip
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date

from app.models import EntryStatus

# MAL's own status strings -> our enum. MAL writes them slightly differently between
# anime and manga exports, so both spellings are mapped.
STATUS_MAP = {
    "watching": EntryStatus.current,
    "reading": EntryStatus.current,
    "completed": EntryStatus.completed,
    "on-hold": EntryStatus.on_hold,
    "on hold": EntryStatus.on_hold,
    "dropped": EntryStatus.dropped,
    "plan to watch": EntryStatus.planned,
    "plan to read": EntryStatus.planned,
}


@dataclass(slots=True)
class MalEntry:
    mal_id: int
    type: str  # "anime" | "manga"
    title: str
    status: EntryStatus
    score: int | None
    progress: int
    rewatch_count: int
    start_date: date | None
    finish_date: date | None
    notes: str | None


def _text(node: ET.Element, tag: str) -> str | None:
    child = node.find(tag)
    if child is None or child.text is None:
        return None
    value = child.text.strip()
    return value or None


def _int(node: ET.Element, tag: str, default: int = 0) -> int:
    raw = _text(node, tag)
    try:
        return int(raw) if raw else default
    except ValueError:
        return default


def _date(node: ET.Element, tag: str) -> date | None:
    """MAL writes 0000-00-00 for 'unset'."""
    raw = _text(node, tag)
    if not raw or raw.startswith("0000"):
        return None
    try:
        year, month, day = (int(p) for p in raw.split("-"))
    except ValueError:
        return None
    if not year or not month or not day:
        return None
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _decompress(raw: bytes) -> bytes:
    if raw[:2] == b"\x1f\x8b":
        return gzip.decompress(raw)
    return raw


def parse(raw: bytes) -> list[MalEntry]:
    """Parse a MAL export. Unknown statuses and id-less rows are skipped, not fatal."""
    root = ET.fromstring(_decompress(raw).decode("utf-8", errors="replace"))
    entries: list[MalEntry] = []

    for node in list(root.findall("anime")) + list(root.findall("manga")):
        is_anime = node.tag == "anime"
        media_type = "anime" if is_anime else "manga"

        mal_id = _int(node, "series_animedb_id" if is_anime else "series_mangadb_id")
        if not mal_id:
            continue

        raw_status = (_text(node, "my_status") or "").strip().lower()
        status = STATUS_MAP.get(raw_status)
        if status is None:
            continue

        score = _int(node, "my_score")
        entries.append(
            MalEntry(
                mal_id=mal_id,
                type=media_type,
                title=_text(node, "series_title") or f"MAL #{mal_id}",
                status=status,
                score=score if 1 <= score <= 10 else None,
                progress=_int(node, "my_watched_episodes" if is_anime else "my_read_chapters"),
                rewatch_count=_int(node, "my_times_watched" if is_anime else "my_times_read"),
                start_date=_date(node, "my_start_date"),
                finish_date=_date(node, "my_finish_date"),
                notes=_text(node, "my_comments"),
            )
        )
    return entries
