# syntax=docker/dockerfile:1

# ---------- Stage 1: build the React bundle ----------
# Node exists only here. The runtime image ships static files, not a Node process.
FROM node:22-alpine AS frontend
WORKDIR /build

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build


# ---------- Stage 2: build Python wheels ----------
FROM python:3.12-slim AS backend-build
WORKDIR /build

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN pip install --no-cache-dir --prefix=/install .


# ---------- Stage 3: runtime ----------
FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN useradd --system --create-home --uid 10001 anitrack
WORKDIR /app

COPY --from=backend-build /install /usr/local
COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./alembic.ini
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# The SPA is served by the backend from app/static -- one fewer container.
COPY --from=frontend /build/dist ./app/static

RUN chmod +x /usr/local/bin/entrypoint.sh && chown -R anitrack:anitrack /app

USER anitrack
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2).status==200 else 1)"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
