#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${1:-/app/data}"
MODEL_URL="https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.de.300.bin.gz"
MODEL_PATH="/tmp/cc.de.300.bin.gz"
MODEL_BIN="/tmp/cc.de.300.bin"
# 80k is the sweet spot for guessable-word coverage: it captures the real words
# players actually type (compounds, specialised terms) without reaching into the
# rare/inflected tail that begins past ~100k (the filtered German vocabulary
# tops out around ~116k anyway). Solution words are filtered independently, so a
# larger vocabulary only widens the *guessable* set, never the solution quality.
VOCAB_SIZE="${VOCAB_SIZE:-80000}"
# Solution words are restricted to ones virtually everyone knows (German Zipf
# ≥ 4.0 in prepare.py), which yields a pool of ~2500 words, so the game count
# is capped a little below that. ~2400 daily puzzles ≈ 6.5 years.
NUM_GAMES="${NUM_GAMES:-2400}"
# Game 1 is the day the data is generated, so a regeneration restarts the daily
# series at the beginning. Override START_DATE (YYYY-MM-DD) to pin a launch day.
START_DATE="${START_DATE:-$(date +%F)}"

echo "=== Kontexto Data Preparation ==="

# A pre-seeded model can be supplied via FASTTEXT_MODEL to avoid the multi-GB
# download on every (re)build, useful for local Docker iteration and for
# redeploys. It may be a .bin/.vec or a .gz of either (prepare.py reads both).
if [ -n "${FASTTEXT_MODEL:-}" ]; then
    if [ ! -f "$FASTTEXT_MODEL" ]; then
        echo "FASTTEXT_MODEL is set but not found: $FASTTEXT_MODEL" >&2
        exit 1
    fi
    case "$FASTTEXT_MODEL" in
        *.gz)
            MODEL_BIN="/tmp/$(basename "${FASTTEXT_MODEL%.gz}")"
            if [ ! -f "$MODEL_BIN" ]; then
                echo "Decompressing provided model $FASTTEXT_MODEL ..."
                gunzip -c "$FASTTEXT_MODEL" > "$MODEL_BIN"
            fi
            ;;
        *)
            MODEL_BIN="$FASTTEXT_MODEL"
            ;;
    esac
    echo "Using provided model: $MODEL_BIN"
elif [ ! -f "$MODEL_BIN" ]; then
    echo "Downloading fastText German model..."
    wget -q --show-progress -O "$MODEL_PATH" "$MODEL_URL"
    echo "Decompressing model..."
    gunzip "$MODEL_PATH"
fi

echo "Running preparation pipeline..."
cd /app/backend
python3 prepare.py \
    --fasttext "$MODEL_BIN" \
    --output "$DATA_DIR" \
    --games "$NUM_GAMES" \
    --vocab-size "$VOCAB_SIZE" \
    --start-date "$START_DATE"

echo "=== Data preparation complete ==="
echo "Vocabulary size: $(python3 -c "import json; print(len(json.load(open('$DATA_DIR/vocabulary.json'))))")"
echo "Games generated: $(ls "$DATA_DIR/games/" | wc -l)"
