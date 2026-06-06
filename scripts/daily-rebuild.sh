#!/usr/bin/env bash
# Daily rebuild + deploy for kontexto.de
# Regenerates the static export with fresh archive pages, sitemap lastmod,
# and (once seeded) AggregateRating. Runs after midnight so the new daily word
# is already locked in the backend.
#
# REQUIREMENTS:
#   - Run on the same host (or Docker network) where the FastAPI backend is reachable.
#   - pnpm must be installed and in PATH.
#   - The deploy target directory (/srv/kontexto/out/) must be writable.
#
# ENVIRONMENT (override via env or cron pre-export):
#   KONTEXTO_BUILD_API_BASE   — base URL of the FastAPI API (default: http://127.0.0.1:8000/api)
#   KONTEXTO_BUILD_DATE       — ISO date for sitemap lastmod (auto-set to today)
#
# ENFORCED GUARDS (build fails if these fail):
#   KONTEXTO_REQUIRE_ARCHIVE=1   — archive fetch MUST succeed; a broken archive won't deploy.
#   KONTEXTO_REQUIRE_IMPRESSUM=1 — legal Impressum data in frontend/lib/legal.ts MUST be filled.
#                                  This guard will cause the build to FAIL until the user fills
#                                  legal.ts from the address service before public launch.
#                                  DO NOT remove this until legal.ts is populated.
set -euo pipefail

cd "$(dirname "$0")/../frontend"

export KONTEXTO_BUILD_API_BASE="${KONTEXTO_BUILD_API_BASE:-http://127.0.0.1:8000/api}"
export KONTEXTO_BUILD_DATE="$(date -u +%F)"

# Fail-fast guards: a broken archive or missing Impressum must never reach production.
export KONTEXTO_REQUIRE_ARCHIVE=1
# INTENTIONAL: enforces that frontend/lib/legal.ts is filled before public launch.
# Remove or unset only after legal.ts contains real data from the address service.
export KONTEXTO_REQUIRE_IMPRESSUM=1

echo "[rebuild] date=${KONTEXTO_BUILD_DATE} api=${KONTEXTO_BUILD_API_BASE}"

pnpm install --frozen-lockfile
pnpm build
node scripts/seo-check.mjs

# Atomic swap into the served directory.
# Adjust the target path to match your deployment setup.
rsync -a --delete out/ /srv/kontexto/out/

echo "[rebuild] daily rebuild complete: ${KONTEXTO_BUILD_DATE}"
