#!/usr/bin/env bash
# Upload the rebuilt concrete-noun pool to production.
#
# Why staged and not copied straight in: the backend reads target_words.json and
# metadata.json once at startup and caches rank arrays per game. Writing the new
# npz into the live games/ directory first would leave the running process
# serving yesterday's solution against today's rank array for every game from
# 107 up. So everything lands in a staging directory inside the volume, the swap
# is three moves, and the restart is the switch.
#
# The previous pool is kept as games.previous until it is explicitly dropped, so
# a rollback is two moves and a restart rather than a two-hour regeneration.
#
# Usage:
#   scripts/upload-concrete-pool.sh <out-dir>            # upload and swap
#   scripts/upload-concrete-pool.sh <out-dir> --dry-run  # print, change nothing
#   scripts/upload-concrete-pool.sh --rollback           # put the old pool back
#   scripts/upload-concrete-pool.sh --drop-previous      # free the old pool's disk

set -euo pipefail

HOST="${KONTEXTO_HOST:-deploy@157.90.151.121}"
KEY="${KONTEXTO_SSH_KEY:-$HOME/.ssh/kontexto-deploy}"
COMPOSE="docker compose -f /opt/kontexto/docker-compose.yml"
SERVICE="kontexto"

remote() {
    ssh -i "$KEY" -o BatchMode=yes "$HOST" "$@"
}

in_container() {
    remote "$COMPOSE exec -T $SERVICE $*"
}

# The image carries no curl, and reaching the app from the host means going
# through Caddy and its certificate. The API workers listen on 8000 inside the
# container, which is the shortest honest path to an answer.
api_get() {
    in_container "python3 -c \"import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/api/$1').read().decode())\"" | tr -d '\r'
}

case "${1:-}" in
    --rollback)
        echo "Rolling back to the previous pool ..."
        in_container "sh -c 'cd /app/data && test -d games.previous && \
            rm -rf games.broken && mv games games.broken && mv games.previous games && \
            mv target_words.previous.json target_words.json && \
            mv metadata.previous.json metadata.json'"
        remote "$COMPOSE restart $SERVICE"
        echo "Rolled back. The rejected pool is at /app/data/games.broken."
        exit 0
        ;;
    --drop-previous)
        echo "Dropping the previous pool ..."
        in_container "sh -c 'cd /app/data && rm -rf games.previous games.broken \
            target_words.previous.json metadata.previous.json'"
        in_container "du -sh /app/data"
        exit 0
        ;;
esac

OUT_DIR="${1:?usage: upload-concrete-pool.sh <out-dir> [--dry-run]}"
DRY_RUN="${2:-}"

for required in target_words.json metadata.json manifest.json games; do
    [ -e "$OUT_DIR/$required" ] || { echo "ABORT: $OUT_DIR/$required missing"; exit 1; }
done

NEW_TOTAL=$(python -c "import json;print(json.load(open('$OUT_DIR/metadata.json'))['total_games'])")
CUTOFF=$(python -c "import json;print(json.load(open('$OUT_DIR/manifest.json'))['cutoff'])")
NPZ_COUNT=$(find "$OUT_DIR/games" -name '*.npz' | wc -l)
EXPECTED=$((NEW_TOTAL - CUTOFF))

echo "Local artifacts: total_games=$NEW_TOTAL cutoff=$CUTOFF npz=$NPZ_COUNT"
[ "$NPZ_COUNT" -eq "$EXPECTED" ] || { echo "ABORT: expected $EXPECTED npz, found $NPZ_COUNT"; exit 1; }

BEFORE=$(api_get game)
echo "Production before: $BEFORE"

if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "Dry run: nothing was uploaded."
    exit 0
fi

echo "Staging the new pool in the volume ..."
in_container "sh -c 'rm -rf /app/data/.staging && mkdir -p /app/data/.staging/games'"

# The played games keep their deployed npz, so only 107 upwards travel. Sent as
# one tar stream: 3,927 separate copies over ssh would take far longer than the
# generation did.
tar -C "$OUT_DIR" -cf - games target_words.json metadata.json \
  | remote "$COMPOSE exec -T $SERVICE tar -C /app/data/.staging -xf -"

echo "Verifying the staged copy ..."
STAGED=$(in_container "sh -c 'ls /app/data/.staging/games | wc -l'" | tr -d '\r')
[ "$STAGED" -eq "$EXPECTED" ] || { echo "ABORT: staged $STAGED npz, expected $EXPECTED"; exit 1; }

echo "Swapping ..."
# The played npz are copied across rather than re-uploaded, so the swapped-in
# directory is complete on its own and the old one can stay untouched for a
# rollback.
in_container "sh -c 'cd /app/data && for n in \$(seq 1 $CUTOFF); do \
    cp games/\$(printf %04d \$n).npz .staging/games/ ; done'"
in_container "sh -c 'cd /app/data && \
    cp target_words.json target_words.previous.json && \
    cp metadata.json metadata.previous.json && \
    rm -rf games.previous && mv games games.previous && \
    mv .staging/games games && \
    mv .staging/target_words.json target_words.json && \
    mv .staging/metadata.json metadata.json && \
    rmdir .staging'"
in_container "sh -c 'chown -R appuser:appuser /app/data/games /app/data/*.json'" || true

echo "Restarting ..."
remote "$COMPOSE restart $SERVICE"
sleep 10

AFTER=$(api_get game)
echo "Production after:  $AFTER"

BEFORE_GAME=$(echo "$BEFORE" | python -c "import json,sys;print(json.load(sys.stdin)['gameNumber'])")
AFTER_GAME=$(echo "$AFTER" | python -c "import json,sys;print(json.load(sys.stdin)['gameNumber'])")
if [ "$BEFORE_GAME" != "$AFTER_GAME" ]; then
    echo "ABORT: the daily game number moved, $BEFORE_GAME -> $AFTER_GAME. Roll back."
    exit 1
fi
echo "The daily game number is unchanged ($AFTER_GAME)."

echo "Spot check, a game from the rebuilt range:"
api_get "closest?game=$((CUTOFF + 1))" | head -c 200
echo
in_container "du -sh /app/data"
echo
echo "Done. The old pool is kept at /app/data/games.previous."
echo "Once tomorrow's puzzle has been played, free the disk:"
echo "  scripts/upload-concrete-pool.sh --drop-previous"
