FROM python:3.13-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /usr/local/bin/uv
WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .
RUN useradd --system --uid 1001 api && chown -R api /app
USER api
EXPOSE 8000
# Migrations run on start, so a fresh database (Render, Docker) is ready on first boot.
# One worker keeps memory low; scale by running more containers. Hosts may set PORT.
CMD ["sh", "-c", "/app/.venv/bin/alembic upgrade head && exec /app/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips '*'"]
