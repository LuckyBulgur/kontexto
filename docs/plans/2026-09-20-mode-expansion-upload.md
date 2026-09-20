# Runbook: growing the game pool on production

Companion to `scripts/extend-game-pool.py`. Same posture as the
`regenerate-future-games.py` run: compute locally, verify locally, upload the
artifacts, never compute on the server.

Nothing here has been executed. The script writes the artifacts and stops.

## Why it is safe

`games/{NNNN}.npz` stores `ranks[i]` as the rank of `index_to_word[i]`,
positionally bound to `vocabulary.json`. Appending games touches neither the
vocabulary nor any existing npz, and the new `target_words.json` keeps the old
list as its exact prefix. Only `metadata.json.total_games` changes.

`duels.db` is never touched.

Three gates in the script abort before anything is written:

1. **Wrap gate.** Today's game is `((days - 1) % total_games) + 1`. Before the
   series has wrapped once, that modulo is a no-op and raising `total_games`
   changes nothing. After it, every future daily would shift. The script refuses
   to run past the first wrap.
2. **Vocab gate.** The vocabulary reproduced from the `.vec` file must equal
   prod's `vocabulary.json` exactly.
3. **Fidelity gate.** A sample of existing npz must be reproduced bit for bit.

## Cost

One npz over the 80k vocabulary is about 215 KiB (measured, not estimated).

| Pool | Data in `/app/data` |
|-|-|
| 2,400 (current) | about 0.49 GiB |
| 10,000 | about 2.05 GiB |

The data lives in the `kontexto-data` volume, not in the image, so the Docker
build and the image size are unaffected. The upload is a one-off transfer of
roughly 1.6 GiB. Check the server's free disk before starting.

## Steps

### 1. Pull prod data read-only

```bash
mkdir -p .regen-work/prod
ssh kontexto 'docker compose -f /opt/kontexto/docker-compose.yml exec -T kontexto \
    tar -C /app/data -cf - metadata.json target_words.json vocabulary.json games' \
  | tar -C .regen-work/prod -xf -
```

`lemma_map.json` and `bloom.bin` are not needed: the script neither reads nor
changes them.

### 2. Run the script

```bash
python scripts/extend-game-pool.py \
    --vec .model-cache/cc.de.300.vec \
    --prod-dir .regen-work/prod \
    --out-dir  .regen-work/out \
    --target-total 10000
```

It prints how many appended solutions sit at or above the standard frequency bar
(Zipf 4.0) and how many come from the band below it. Read that number before
uploading: a pool that is mostly made of rare words is a different game.

If it aborts with "only N clean unused words available", the vocabulary does not
hold 10,000 fair solutions at the chosen bar. Lower `--target-total` rather than
`--min-zipf-floor` below 3.0.

### 3. Check the manifest

```bash
python -c "import json;m=json.load(open('.regen-work/out/manifest.json'));print(m['previous_total_games'],'->',m['new_total_games'],m['appended_above_standard_bar'],'above the standard bar')"
head -c 400 .regen-work/out/manifest.json
```

Spot-check a handful of `appended_words` by hand. The filter is good, not
infallible, and a bad solution is visible to everyone who draws it.

### 4. Upload

```bash
tar -C .regen-work/out -cf - games target_words.json metadata.json \
  | ssh kontexto 'docker compose -f /opt/kontexto/docker-compose.yml exec -T kontexto \
      tar -C /app/data -xf -'
```

`games/` only contains the new files, so this adds without overwriting.
`target_words.json` and `metadata.json` are replaced, which is the point.

### 5. Restart and verify

```bash
ssh kontexto 'docker compose -f /opt/kontexto/docker-compose.yml restart kontexto'
curl -s https://kontexto.de/api/game
curl -s https://kontexto.de/api/infinite/next
```

`/api/game` must still report the same `gameNumber` as before the upload. If it
does not, the wrap gate was wrong about the schedule and the old
`metadata.json` should go back immediately.

`/api/infinite/next` must report the new `totalGames`.

### 6. Roll back

Keep the pulled copy until the next day's puzzle has been played. Restoring is
putting the old `metadata.json` and `target_words.json` back; the appended npz
files are then simply unreachable and can be deleted at leisure.
