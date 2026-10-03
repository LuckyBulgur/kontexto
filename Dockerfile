# --- Stage 1: Build frontend ---
FROM node:24.19.0-alpine AS frontend-build
WORKDIR /app/frontend
# Copy the pnpm settings first so Corepack can provision the exact pnpm version
# pinned in package.json's "packageManager" field (deterministic, hash-verified
# builds, no floating pnpm@latest). pnpm-workspace.yaml carries the overrides.
COPY frontend/package.json frontend/pnpm-workspace.yaml frontend/pnpm-lock.yaml ./
RUN corepack enable && corepack install
RUN pnpm install --frozen-lockfile
COPY frontend/ .
# The commit this image is built from. Inlined as the build id an open tab
# compares with /version.json, so a tab notices a deploy and reloads
# (frontend/lib/update-check.ts). "dev" switches that off. Declared after the
# install, so a new commit invalidates only the layers from the build on.
ARG KONTEXTO_BUILD_ID=dev
ENV NEXT_PUBLIC_BUILD_ID=${KONTEXTO_BUILD_ID}
# pnpm 11 re-verifies deps before running a script and, finding the just-copied
# project, tries to reinstall, which aborts in a non-interactive build
# (ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY). The frozen-lockfile install above
# is authoritative, so skip the redundant pre-run check.
RUN pnpm config set verify-deps-before-run false && pnpm run build

# --- Stage 2: Production ---
# Ordered by how often a layer changes: system packages, Python dependencies
# and configuration first, the code last, so a push rebuilds and ships only the
# code layers.
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx supervisor wget gosu && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user. Only /app itself is chowned here; everything copied
# into it below carries --chown, which writes the owner with the file instead
# of rewriting every file into a second layer.
RUN groupadd -r appuser && useradd -r -g appuser -s /sbin/nologin appuser && \
    chown appuser:appuser /app

COPY --chown=appuser:appuser backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Configure nginx for non-root: remove user directive, fix pid path
RUN rm -f /etc/nginx/sites-enabled/default && \
    sed -i '/^user /d' /etc/nginx/nginx.conf && \
    sed -i 's|pid /run/nginx.pid;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf && \
    mkdir -p /var/cache/nginx /tmp/nginx && \
    chown -R appuser:appuser /var/log/nginx /var/lib/nginx /var/cache/nginx /tmp/nginx

EXPOSE 8080

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

# A data volume from before the typo correction has everything but the index.
# Building it once here beats every API worker building its own copy on the
# first mistyped guess.
gosu appuser python3 /app/scripts/build-spell-index.py /app/data

# Not just "is it there": a volume from an earlier deploy keeps whatever list
# it was built with, and the rules that produce that list do change. The word
# "pussy" sat in a generated solution list until 2026-09-21 for exactly that
# reason. LIST_VERSION in the script is the contract; a mismatch rebuilds.
# The version is read out of the source with a regex rather than imported: the
# script pulls in wordfreq and the whole preparation module at import time, and
# a startup check should not pay for that.
if ! gosu appuser python3 -c "
import json, re, sys
source = open('/app/scripts/prepare-wordle-data.py', encoding='utf-8').read()
want = int(re.search(r'^LIST_VERSION = (\d+)', source, re.M).group(1))
have = json.load(open('/app/data/wordle/meta.json'))['list_version']
sys.exit(0 if have >= want else 1)
" 2>/dev/null; then
    echo "Wordle data missing or outdated. Running Wordle data preparation..."
    gosu appuser python3 /app/scripts/prepare-wordle-data.py
fi

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
ENTRYPOINT
RUN chmod +x /app/entrypoint.sh

COPY --chown=appuser:appuser backend/ backend/
COPY --chown=appuser:appuser scripts/ scripts/
RUN chmod +x scripts/prepare-data.sh
COPY --chown=appuser:appuser --from=frontend-build /app/frontend/out /app/frontend/out

CMD ["/app/entrypoint.sh"]
