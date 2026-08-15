from app.providers.base import Covers, MediaProvider, MediaRecord, NotFound

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
