from datetime import date

from app.providers.base import Covers, MediaProvider, MediaRecord, NotFound, Related

CATALOG = {
    ("16498", "anime"): MediaRecord(
        provider="stub",
        provider_id="16498",
        mal_id=16498,
        type="anime",
        title_romaji="Shingeki no Kyojin",
        title_english="Attack on Titan",
        title_native="進撃の巨人",
        synonyms=["AoT"],
        covers=Covers(large="https://img/aot-l.jpg", color="#e4a15d"),
        synopsis="Humans versus titans.",
        total_units=25,
        format="TV",
        status="FINISHED",
        season_year=2013,
        genres=["Action"],
        average_score=84,
        duration=24,
    ),
    ("1535", "anime"): MediaRecord(
        provider="stub",
        provider_id="1535",
        mal_id=1535,
        type="anime",
        title_romaji="Death Note",
        title_english="Death Note",
        total_units=37,
        duration=23,
    ),
    # A three-season chain, linked only through its immediate neighbours the way a
    # real provider reports it. Each season carries its own cover and episode count,
    # which is what the season switcher shows.
    ("900", "anime"): MediaRecord(
        provider="stub",
        provider_id="900",
        type="anime",
        title_romaji="Frieren",
        title_english="Frieren",
        covers=Covers(large="https://img/frieren-s1.jpg"),
        total_units=28,
        format="TV",
        start_date=date(2020, 1, 10),
        sequel_id="901",
        # A movie and an OVA hang off season 1, plus a manga adaptation and a
        # spin-off that must *not* be folded in.
        related=[
            Related(provider_id="910", relation="SIDE_STORY", format="MOVIE"),
            Related(provider_id="911", relation="SPECIAL", format="OVA"),
            Related(provider_id="912", relation="ADAPTATION", format="MANGA"),
            Related(provider_id="913", relation="OTHER", format="TV"),
        ],
    ),
    ("901", "anime"): MediaRecord(
        provider="stub",
        provider_id="901",
        type="anime",
        title_romaji="Frieren Season 2",
        title_english="Frieren Season 2",
        covers=Covers(large="https://img/frieren-s2.jpg"),
        total_units=12,
        format="TV",
        start_date=date(2022, 4, 1),
        prequel_id="900",
        sequel_id="902",
    ),
    ("902", "anime"): MediaRecord(
        provider="stub",
        provider_id="902",
        type="anime",
        title_romaji="Frieren Season 3",
        title_english="Frieren Season 3",
        covers=Covers(large="https://img/frieren-s3.jpg"),
        total_units=13,
        format="TV",
        start_date=date(2024, 10, 4),
        prequel_id="901",
    ),
    # Released between seasons 1 and 2, so release order must place it there.
    ("910", "anime"): MediaRecord(
        provider="stub",
        provider_id="910",
        type="anime",
        title_romaji="Frieren: The Movie",
        title_english="Frieren: The Movie",
        covers=Covers(large="https://img/frieren-movie.jpg"),
        total_units=1,
        format="MOVIE",
        start_date=date(2021, 7, 2),
        related=[Related(provider_id="900", relation="PARENT", format="TV")],
    ),
    ("911", "anime"): MediaRecord(
        provider="stub",
        provider_id="911",
        type="anime",
        title_romaji="Frieren OVA",
        title_english="Frieren OVA",
        total_units=2,
        format="OVA",
        start_date=date(2023, 3, 1),
    ),
    ("912", "manga"): MediaRecord(
        provider="stub",
        provider_id="912",
        type="manga",
        title_romaji="Frieren (manga)",
        total_units=140,
        format="MANGA",
    ),
    # Same universe, its own series: an OTHER relation must not pull it in.
    ("913", "anime"): MediaRecord(
        provider="stub",
        provider_id="913",
        type="anime",
        title_romaji="Not Frieren",
        title_english="Not Frieren",
        total_units=12,
        format="TV",
        start_date=date(2025, 1, 1),
    ),
    ("11", "manga"): MediaRecord(
        provider="stub",
        provider_id="11",
        mal_id=11,
        type="manga",
        title_romaji="Berserk",
        title_english="Berserk",
        total_units=None,
    ),
}


class StubProvider(MediaProvider):
    """Deterministic in-memory provider so API tests never touch the network."""

    name = "stub"

    async def search(self, query, type, page=1, per_page=20):
        needle = query.lower()
        return [
            r
            for (pid, t), r in CATALOG.items()
            if t == type and needle in (r.title_romaji or "").lower()
        ]

    async def get_by_id(self, provider_id, type):
        record = CATALOG.get((provider_id, type))
        if record is None:
            raise NotFound(f"stub {type} {provider_id}")
        return record

    async def get_by_mal_id(self, mal_id, type):
        for record in CATALOG.values():
            if record.mal_id == mal_id and record.type == type:
                return record
        raise NotFound(f"stub mal {mal_id}")

    async def get_covers(self, provider_id, type):
        return (await self.get_by_id(provider_id, type)).covers
