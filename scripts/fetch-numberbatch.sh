#!/usr/bin/env bash
# Fetch the German part of ConceptNet Numberbatch for the embedding bench.
# The published file holds every language in one 3,2 GB archive, so this
# streams it and keeps only the German rows, about 1,4 GB of text.
set -euo pipefail
out="$(dirname "$0")/../.model-cache/numberbatch-de.txt"
url="https://conceptnet.s3.amazonaws.com/downloads/2019/numberbatch/numberbatch-19.08.txt.gz"
curl -fL "$url" | gunzip -c | grep '^/c/de/' > "$out"
wc -l < "$out"
