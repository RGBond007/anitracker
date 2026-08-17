# Contributing to AniTracker

Thank you for helping improve AniTracker. Contributions of code, tests, translations,
documentation, accessibility improvements, bug reports, and product feedback are welcome.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating. For vulnerabilities,
follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Before you start

- Search existing issues and pull requests before opening a duplicate.
- Bug fixes and small documentation improvements can go directly to a pull request.
- Discuss substantial features, schema changes, API changes, and UI redesigns in an issue first.
- Keep changes focused. Unrelated cleanup makes review and rollback harder.

Good first issues should have a clear problem statement, acceptance criteria, and pointers to the
relevant code. Ask on the issue before starting if its scope is unclear.

## Development setup

### Requirements

- Git
- Python 3.12
- Node.js 22 and npm
- Docker Engine with Compose v2

Fork the repository, then clone your fork:

```bash
git clone https://github.com/<your-user>/anitrack.git
cd anitrack
git remote add upstream https://github.com/RGBond007/anitrack.git
```

Create a branch from the latest `main`:

```bash
git fetch upstream
git switch -c fix/short-description upstream/main
```

### Backend

Start PostgreSQL for local development:

```bash
docker run -d --name anitracker-dev-db -p 5432:5432 \
  -e POSTGRES_USER=anitrack \
  -e POSTGRES_PASSWORD=anitrack \
  -e POSTGRES_DB=anitrack \
  postgres:16-alpine
```

Install and run the API:

```bash
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -e ".[dev]"
export DATABASE_URL=postgresql+asyncpg://anitrack:anitrack@localhost:5432/anitrack
export JWT_SECRET=local-development-only
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload
```

The API and generated OpenAPI documentation are available at
<http://localhost:8000/api/docs>.

### Frontend

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to the backend on port 8000.

## Repository map

```text
backend/app/                 FastAPI application
backend/app/routers/         HTTP endpoints
backend/app/providers/       AniList, Jikan, and Kitsu integrations
backend/app/importers/       Import pipelines
backend/alembic/versions/    Database migrations
backend/tests/               Backend tests and recorded provider fixtures
frontend/src/components/     Shared React components
frontend/src/features/       Query hooks and feature state
frontend/src/pages/          Route-level screens
frontend/src/locales/        English and German translations
.github/                     CI and contribution workflows
```

The architecture overview in [README.md](README.md#architecture) explains provider caching and
series/season state in more detail.

## Making changes

### Backend

- Keep request handling in routers and reusable behavior in services.
- Route external metadata requests through `media_service.py`; tests must not call live providers.
- Add or update tests for behavior changes.
- Generate an Alembic migration for every schema change and review both upgrade and downgrade
  operations.
- Do not edit an existing migration after it has shipped.

Create a migration from `backend/` with:

```bash
.venv/bin/alembic revision --autogenerate -m "describe the change"
.venv/bin/alembic upgrade head
```

### Frontend

- Use the existing design tokens and shared components before introducing new patterns.
- Keep server state in TanStack Query and UI-only preferences in the Zustand store.
- Preserve responsive behavior and keyboard accessibility.
- Include screenshots for visible changes when opening a pull request.

### Translations

Every user-facing string belongs in both:

- `frontend/src/locales/en.json`
- `frontend/src/locales/de.json`

Keep both files structurally aligned. Do not place untranslated English text in the German locale
as a permanent fallback.

### Changelog

Add user-visible changes under `Unreleased` in [CHANGELOG.md](CHANGELOG.md). Internal refactors,
test-only changes, and typo fixes normally do not need an entry.

## Required checks

Run the same checks as CI before opening a pull request:

```bash
cd backend
.venv/bin/ruff check .
.venv/bin/ruff format --check .
.venv/bin/pytest -q

cd ../frontend
npm run lint
npm run build

cd ..
docker build -t anitracker:contributor-check .
```

Tests use recorded fixtures and an in-memory SQLite database; they do not require live provider
access. A clean Docker build catches integration and packaging errors not covered by unit tests.

## Pull requests

- Use a descriptive title written as an imperative, for example `Fix season selection race`.
- Explain the problem, the chosen solution, and any tradeoffs.
- Link the relevant issue with `Fixes #123` when applicable.
- Keep generated files and unrelated formatting out of the change.
- Respond to review feedback with follow-up commits; maintainers may squash on merge.
- Confirm that CI passes. Draft pull requests are welcome for early feedback.

Maintainers may ask to split a pull request when independent changes would be easier to review and
release separately.

## Licensing

By submitting a contribution, you agree that it is your original work, that you have the right to
submit it, and that it is licensed under the repository's
[GNU Affero General Public License v3.0 only](LICENSE) (`AGPL-3.0-only`). Do not submit proprietary
code, copyrighted media, generated assets, or third-party material without compatible licensing
and required attribution.

## Getting help

Use a GitHub issue for reproducible bugs and scoped feature proposals. See [SUPPORT.md](SUPPORT.md)
for usage and troubleshooting questions.
