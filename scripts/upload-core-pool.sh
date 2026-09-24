#!/usr/bin/env bash
# Upload the core-lexicon rebuild to production.
#
# Why this is not upload-concrete-pool.sh: that one ships only the games from
# the cutoff upwards and copies the played npz across inside the volume,
# because a rebuild used to leave them untouched. This rebuild changes the
# space itself (the vectors are debiased on the core lexicon), so every rank
# array is new, the played ones included. It also ships the three files the
# runtime reads at startup: core_words.json, which decides what a rank counts,
# fold_map.json, which says what every other guessable form is scored as, and
# everyday_words.json, which decides what a tip or an opening word may name.
# The three are written by one build and have to travel together, because a
# list without its folds refuses every plural and a scale without its everyday
# list hands out rare compounds as tips.
#
# The staging and swap are the same as before, and for the same reason: the
# backend reads target_words.json once at startup and caches rank arrays per
# game, so writing into the live games/ directory would serve one pool's
# solutions against another pool's ranks until the restart.
#
# The previous pool is kept as games.previous until dropped, so a rollback is a
# few moves and a restart instead of a two-hour regeneration.
#
# Usage:
#   scripts/upload-core-pool.sh <out-dir>            # upload and swap
#   scripts/upload-core-pool.sh <out-dir> --dry-run  # print, change nothing
#   scripts/upload-core-pool.sh --rollback           # put the old pool back
#   scripts/upload-core-pool.sh --drop-previous      # free the old pool's disk

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

api_get() {
    in_container "python3 -c \"import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/api/$1').read().decode())\"" | tr -d '\r'
}

case "${1:-}" in
    --rollback)
        echo "Rolling back to the previous pool ..."
        in_container "sh -c 'cd /app/data && test -d games.previous && \
            rm -rf games.broken && mv games games.broken && mv games.previous games && \
            mv target_words.previous.json target_words.json && \
            mv metadata.previous.json metadata.json && \
            if [ -f core_words.previous.json ]; then mv core_words.previous.json core_words.json; \
            else rm -f core_words.json; fi && \
            if [ -f fold_map.previous.json ]; then mv fold_map.previous.json fold_map.json; \
            else rm -f fold_map.json; fi && \
            if [ -f everyday_words.previous.json ]; then mv everyday_words.previous.json everyday_words.json; \
            else rm -f everyday_words.json; fi'"
        remote "$COMPOSE restart $SERVICE"
        echo "Rolled back. The rejected pool is at /app/data/games.broken."
        exit 0
        ;;
    --rollback-lexicon)
        echo "Rolling back the lexicon ..."
        in_container "sh -c 'cd /app/data && test -f core_words.previous.json && \
            mv core_words.previous.json core_words.json && \
            mv fold_map.previous.json fold_map.json && \
            mv metadata.previous.json metadata.json'"
        remote "$COMPOSE restart $SERVICE"
        echo "Rolled back. The games were never touched."
        exit 0
        ;;
    --lexicon-only)
        # A lexicon rebuild (scripts/rebuild-lexicon.py) changes which words
        # hold a number and what every other form is scored as, and nothing
        # else: the rank arrays and the everyday list stay as they are, so only
        # three small files travel. The build recorded a hash of every deployed
        # file it started from, and a production that no longer matches them
        # would get a lexicon built for other data.
        OUT_DIR="${2:?usage: upload-core-pool.sh --lexicon-only <out-dir> [--dry-run]}"
        DRY_RUN="${3:-}"
        for required in manifest.json core_words.json fold_map.json metadata.json; do
            [ -e "$OUT_DIR/$required" ] || { echo "ABORT: $OUT_DIR/$required missing"; exit 1; }
        done
        MODE=$(python -c "import json;print(json.load(open('$OUT_DIR/manifest.json')).get('mode',''))")
        [ "$MODE" = "lexicon" ] || { echo "ABORT: $OUT_DIR is not a lexicon build (mode '$MODE')"; exit 1; }
        CORE_SIZE=$(python -c "import json;print(len(json.load(open('$OUT_DIR/core_words.json'))))")
        echo "Local artifacts: core=$CORE_SIZE"

        echo "Checking that production is the data the build started from ..."
        for name in $(python -c "import json;print(' '.join(json.load(open('$OUT_DIR/manifest.json'))['base']))"); do
            WANT=$(python -c "import json;print(json.load(open('$OUT_DIR/manifest.json'))['base']['$name'])")
            HAVE=$(in_container "python3 -c \"import hashlib;print(hashlib.sha256(open('/app/data/$name','rb').read()).hexdigest())\"" | tr -d '\r')
            if [ "$WANT" != "$HAVE" ]; then
                echo "ABORT: /app/data/$name changed since the build. Copy production again and rebuild."
                exit 1
            fi
        done
        echo "Production matches."

        BEFORE=$(api_get game)
        echo "Production before: $BEFORE"
        if [ "$DRY_RUN" = "--dry-run" ]; then
            echo "Dry run: nothing was uploaded."
            exit 0
        fi

        in_container "sh -c 'rm -rf /app/data/.staging && mkdir -p /app/data/.staging'"
        tar -C "$OUT_DIR" -czf - core_words.json fold_map.json metadata.json \
          | remote "$COMPOSE exec -T $SERVICE tar -C /app/data/.staging -xzf -"
        echo "Swapping ..."
        in_container "sh -c 'cd /app/data && \
            cp core_words.json core_words.previous.json && \
            cp fold_map.json fold_map.previous.json && \
            cp metadata.json metadata.previous.json && \
            mv .staging/core_words.json core_words.json && \
            mv .staging/fold_map.json fold_map.json && \
            mv .staging/metadata.json metadata.json && \
            rmdir .staging'"
        in_container "sh -c 'chown appuser:appuser /app/data/*.json'" || true
        echo "Restarting ..."
        remote "$COMPOSE restart $SERVICE"
        sleep 10

        AFTER=$(api_get game)
        echo "Production after:  $AFTER"
        BEFORE_GAME=$(echo "$BEFORE" | python -c "import json,sys;print(json.load(sys.stdin)['gameNumber'])")
        AFTER_GAME=$(echo "$AFTER" | python -c "import json,sys;print(json.load(sys.stdin)['gameNumber'])")
        AFTER_TOTAL=$(echo "$AFTER" | python -c "import json,sys;print(json.load(sys.stdin)['total'])")
        [ "$BEFORE_GAME" = "$AFTER_GAME" ] || { echo "ABORT: the daily game moved. Run --rollback-lexicon."; exit 1; }
        [ "$AFTER_TOTAL" = "$CORE_SIZE" ] || { echo "ABORT: the scale is $AFTER_TOTAL, expected $CORE_SIZE. Run --rollback-lexicon."; exit 1; }
        echo "The daily game is unchanged ($AFTER_GAME), the scale is $AFTER_TOTAL words."

        # The words the rebuild was made for, and the ones it must not touch.
        # Umlauts are written as Python escapes, which the string literal
        # resolves, so the check does not depend on the shell's encoding: a
        # plural beside its singular, a finite verb form, a noun that reads
        # like a plural, an infinitive, a rare word, a stop word. The ssh call
        # reads from /dev/null, or it swallows the rest of the list after the
        # first check.
        while read -r guess expected; do
            ANSWER=$(in_container "python3 -c \"import urllib.request as u,json;\
o=u.OpenerDirector();o.add_handler(u.HTTPHandler());\
r=u.Request('http://127.0.0.1:8000/api/guess',data=json.dumps({'word':'$guess'}).encode(),\
headers={'Content-Type':'application/json'});\
d=json.load(o.open(r));print((d.get('word') or d.get('error')).encode('unicode_escape').decode())\"" < /dev/null | tr -d '\r') || ANSWER=""
            if [ "$ANSWER" != "$expected" ]; then
                echo "ABORT: '$guess' answered '$ANSWER', expected '$expected'. Run --rollback-lexicon."
                exit 1
            fi
            echo "  $guess -> $ANSWER"
        done <<'CHECKS'
motorr\u00e4dern motorrad
oldies oldie
kinder kind
wussten wissen
montage montage
arbeiten arbeiten
leggings leggings
heute stopword
CHECKS
        echo "Done. The previous lexicon is kept as *.previous.json; --rollback-lexicon restores it."
        exit 0
        ;;
    --drop-previous)
        echo "Dropping the previous pool ..."
        in_container "sh -c 'cd /app/data && rm -rf games.previous games.broken \
            target_words.previous.json metadata.previous.json core_words.previous.json \
            fold_map.previous.json everyday_words.previous.json'"
        in_container "du -sh /app/data"
        exit 0
        ;;
esac

OUT_DIR="${1:?usage: upload-core-pool.sh <out-dir> [--dry-run]}"
DRY_RUN="${2:-}"

for required in target_words.json metadata.json manifest.json core_words.json \
                fold_map.json everyday_words.json games; do
    [ -e "$OUT_DIR/$required" ] || { echo "ABORT: $OUT_DIR/$required missing"; exit 1; }
done

NEW_TOTAL=$(python -c "import json;print(json.load(open('$OUT_DIR/metadata.json'))['total_games'])")
CORE_SIZE=$(python -c "import json;print(len(json.load(open('$OUT_DIR/core_words.json'))))")
NPZ_COUNT=$(find "$OUT_DIR/games" -name '*.npz' | wc -l)

echo "Local artifacts: total_games=$NEW_TOTAL core=$CORE_SIZE npz=$NPZ_COUNT"
# Every game travels this time, so the count must match exactly.
[ "$NPZ_COUNT" -eq "$NEW_TOTAL" ] || { echo "ABORT: expected $NEW_TOTAL npz, found $NPZ_COUNT"; exit 1; }

BEFORE=$(api_get game)
echo "Production before: $BEFORE"

if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "Dry run: nothing was uploaded."
    exit 0
fi

echo "Staging the new pool in the volume ..."
in_container "sh -c 'rm -rf /app/data/.staging && mkdir -p /app/data/.staging'"

# One compressed tar stream: some 1.900 separate copies over ssh would take far
# longer than the generation did.
tar -C "$OUT_DIR" -czf - games target_words.json metadata.json core_words.json \
      fold_map.json everyday_words.json \
  | remote "$COMPOSE exec -T $SERVICE tar -C /app/data/.staging -xzf -"

echo "Verifying the staged copy ..."
STAGED=$(in_container "sh -c 'ls /app/data/.staging/games | wc -l'" | tr -d '\r')
[ "$STAGED" -eq "$NEW_TOTAL" ] || { echo "ABORT: staged $STAGED npz, expected $NEW_TOTAL"; exit 1; }

echo "Swapping ..."
in_container "sh -c 'cd /app/data && \
    cp target_words.json target_words.previous.json && \
    cp metadata.json metadata.previous.json && \
    if [ -f core_words.json ]; then cp core_words.json core_words.previous.json; fi && \
    if [ -f fold_map.json ]; then cp fold_map.json fold_map.previous.json; fi && \
    if [ -f everyday_words.json ]; then cp everyday_words.json everyday_words.previous.json; fi && \
    rm -rf games.previous && mv games games.previous && \
    mv .staging/games games && \
    mv .staging/target_words.json target_words.json && \
    mv .staging/metadata.json metadata.json && \
    mv .staging/core_words.json core_words.json && \
    mv .staging/fold_map.json fold_map.json && \
    mv .staging/everyday_words.json everyday_words.json && \
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

AFTER_TOTAL=$(echo "$AFTER" | python -c "import json,sys;print(json.load(sys.stdin)['total'])")
if [ "$AFTER_TOTAL" != "$CORE_SIZE" ]; then
    echo "ABORT: the scale is $AFTER_TOTAL, expected the core size $CORE_SIZE."
    echo "core_words.json did not arrive or was not read. Roll back."
    exit 1
fi
echo "The rank scale is the core lexicon ($AFTER_TOTAL words)."

echo "Checking that an inflected form still scores ..."
FOLDED=$(in_container "python3 -c \"import urllib.request,json;\
req=urllib.request.Request('http://127.0.0.1:8000/api/guess', \
data=json.dumps({'word':'kinder'}).encode(), \
headers={'Content-Type':'application/json'});\
print(json.load(urllib.request.urlopen(req))['word'])\"" | tr -d '\r') || FOLDED=""
if [ -z "$FOLDED" ]; then
    echo "ABORT: a plural of a counted word was refused. fold_map.json did not arrive."
    exit 1
fi
echo "A plural scores as its singular ($FOLDED)."

# The scored word for a guess, or the error code when it is refused. The opener
# carries no HTTPErrorProcessor, so a 422 comes back as a body, not an exception.
guess_answer() {
    in_container "python3 -c \"import urllib.request as u,json;\
o=u.OpenerDirector();o.add_handler(u.HTTPHandler());\
r=u.Request('http://127.0.0.1:8000/api/guess',data=json.dumps({'word':'$1'}).encode(),\
headers={'Content-Type':'application/json'});\
d=json.load(o.open(r));print(d.get('word') or d.get('error'))\"" | tr -d '\r'
}

echo "Checking that a rare word counts and a function word does not ..."
RARE=$(guess_answer leggings) || RARE=""
if [ "$RARE" != "leggings" ]; then
    echo "ABORT: 'leggings' answered '$RARE'. The new scale did not arrive. Roll back."
    exit 1
fi
STOP=$(guess_answer heute) || STOP=""
if [ "$STOP" != "stopword" ]; then
    echo "ABORT: 'heute' answered '$STOP' instead of stopword. Roll back."
    exit 1
fi
echo "A rare word counts, a function word is refused."

echo "Spot check, the pool the random modes draw from:"
api_get "infinite/next" | head -c 200
echo
in_container "du -sh /app/data"
echo
echo "Done. The old pool is kept at /app/data/games.previous."
echo "Once tomorrow's puzzle has been played, free the disk:"
echo "  scripts/upload-core-pool.sh --drop-previous"
