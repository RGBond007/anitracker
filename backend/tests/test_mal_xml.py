import gzip
from datetime import date

from app.importers import mal_xml
from app.models import EntryStatus


def test_parses_anime_and_manga_rows(fixture):
    entries = mal_xml.parse(fixture("mal_export.xml"))

    assert len(entries) == 3  # the unknown-status row is skipped
    by_id = {e.mal_id: e for e in entries}

    aot = by_id[16498]
    assert aot.type == "anime"
    assert aot.status == EntryStatus.completed
    assert aot.score == 9
    assert aot.progress == 25
    assert aot.rewatch_count == 2
    assert aot.start_date == date(2013, 4, 10)
    assert aot.finish_date == date(2013, 9, 30)
    assert aot.notes == "Season 1 is peak."

    berserk = by_id[11]
    assert berserk.type == "manga"
    assert berserk.status == EntryStatus.current  # "Reading"
    assert berserk.progress == 364


def test_zero_score_and_zero_dates_become_null(fixture):
    entries = {e.mal_id: e for e in mal_xml.parse(fixture("mal_export.xml"))}
    death_note = entries[1535]
    assert death_note.score is None
    assert death_note.start_date is None
    assert death_note.finish_date is None
    assert death_note.notes is None


def test_accepts_gzipped_export(fixture):
    raw = fixture("mal_export.xml")
    assert len(mal_xml.parse(gzip.compress(raw))) == 3


def test_status_map_covers_every_mal_label():
    assert set(mal_xml.STATUS_MAP.values()) == set(EntryStatus)
