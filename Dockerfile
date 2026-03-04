# --- Stage 1: Build frontend ---
FROM node:20-alpine AS frontend-build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ .
RUN pnpm run build

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

COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY scripts/ scripts/
RUN chmod +x scripts/prepare-data.sh
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

COPY --from=frontend-build /app/frontend/out /app/frontend/out

EXPOSE 80

COPY <<'ENTRYPOINT' /app/entrypoint.sh
#!/bin/bash
set -e

if [ ! -f /app/data/metadata.json ]; then
    echo "No data found. Running data preparation..."
    bash /app/scripts/prepare-data.sh /app/data
fi

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
ENTRYPOINT
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
