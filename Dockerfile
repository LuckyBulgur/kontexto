# --- Stage 1: Build frontend ---
FROM node:24.19.0-alpine AS frontend-build
WORKDIR /app/frontend
# Copy the pnpm settings first so Corepack can provision the exact pnpm version
# pinned in package.json's "packageManager" field (deterministic, hash-verified
# builds — no floating pnpm@latest). pnpm-workspace.yaml carries the overrides.
COPY frontend/package.json frontend/pnpm-workspace.yaml frontend/pnpm-lock.yaml ./
RUN corepack enable && corepack install
RUN pnpm install --frozen-lockfile
COPY frontend/ .
# pnpm 11 re-verifies deps before running a script and, finding the just-copied
# project, tries to reinstall — which aborts in a non-interactive build
# (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY). The frozen-lockfile install above
# is authoritative, so skip the redundant pre-run check.
RUN pnpm config set verify-deps-before-run false && pnpm run build

# --- Stage 2: Prepare data ---
FROM python:3.12-slim AS data-build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY scripts/ scripts/
RUN chmod +x scripts/prepare-data.sh
# Data preparation happens at build time if model is provided
# Or at runtime via entrypoint

# --- Stage 3: Production ---
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx supervisor wget && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -s /sbin/nologin appuser

COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY scripts/ scripts/
RUN chmod +x scripts/prepare-data.sh
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

COPY --from=frontend-build /app/frontend/out /app/frontend/out

# Configure nginx for non-root: remove user directive, fix pid path
RUN sed -i '/^user /d' /etc/nginx/nginx.conf && \
    sed -i 's|pid /run/nginx.pid;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf && \
    mkdir -p /var/cache/nginx /tmp/nginx && \
    chown -R appuser:appuser /var/log/nginx /var/lib/nginx /var/cache/nginx && \
    chown -R appuser:appuser /app /tmp/nginx

EXPOSE 8080

RUN apt-get update && apt-get install -y --no-install-recommends gosu && rm -rf /var/lib/apt/lists/*

COPY <<'ENTRYPOINT' /app/entrypoint.sh
#!/bin/bash
set -e

# Fix volume permissions (volume mounts as root)
mkdir -p /app/data/games
chown -R appuser:appuser /app/data

if [ ! -f /app/data/metadata.json ]; then
    echo "No data found. Running data preparation..."
    gosu appuser bash /app/scripts/prepare-data.sh /app/data
fi

if [ ! -f /app/data/wordle/solutions.json ]; then
    echo "No Wordle data found. Running Wordle data preparation..."
    gosu appuser python3 /app/scripts/prepare-wordle-data.py
fi

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
ENTRYPOINT
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
