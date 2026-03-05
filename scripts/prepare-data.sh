#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${1:-/app/data}"
MODEL_URL="https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.de.300.bin.gz"
MODEL_PATH="/tmp/cc.de.300.bin.gz"
MODEL_BIN="/tmp/cc.de.300.bin"
VOCAB_SIZE="${VOCAB_SIZE:-50000}"
NUM_GAMES="${NUM_GAMES:-1000}"

echo "=== Kontexto Data Preparation ==="

if [ ! -f "$MODEL_BIN" ]; then
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
    --vocab-size "$VOCAB_SIZE"

echo "=== Data preparation complete ==="
echo "Vocabulary size: $(python3 -c "import json; print(len(json.load(open('$DATA_DIR/vocabulary.json'))))")"
echo "Games generated: $(ls "$DATA_DIR/games/" | wc -l)"
