from sqlalchemy import JSON, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.types import TypeDecorator


class StringArray(TypeDecorator):
    """Native ``text[]`` on Postgres, JSON everywhere else.

    Production is Postgres-only; the JSON branch exists so the test suite can run
    against in-memory SQLite without standing up a container.
    """

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(ARRAY(String))
        return dialect.type_descriptor(JSON())

    def process_bind_param(self, value, dialect):
        return list(value) if value is not None else None

    def process_result_value(self, value, dialect):
        return list(value) if value is not None else []
