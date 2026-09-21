# Taking the README screenshots

The images under `docs/assets/screenshots/` are produced by
`frontend/e2e/readme-shots.spec.ts`, not cropped by hand, so they can be re-taken
after a redesign instead of quietly ageing.

## Why not the mock dataset

The smoke suite runs on `data-e2e`, built by `scripts/create-test-data.py`. That
dataset holds 144 words and assigns ranks by index distance, so a picture of it
shows pairs a German reader immediately sees through ("und" on rank 7) and every
bar lands in the near band, which hides two thirds of the rank ramp. A
screenshot has to be truthful about what the game feels like, so the shots run
against a small but real dataset.

## Building the screenshot dataset

The full pipeline downloads the German fastText model, several GB, and computes
thousands of games. That is not needed for six pictures. A truncated `.vec` is
enough: fastText ships its vectors in frequency order, so the first 60.000 lines
are the 60.000 most frequent tokens, which is where every word a screenshot
shows comes from anyway. `prepare.py` reads a `.vec` file directly (only the
`.bin` path needs the `fasttext` package).

```bash
# 1. The vectors, roughly 135 MB of text instead of several GB.
#    The pipe closes early on purpose; curl reporting error 23 is that, not a failure.
curl -sS -L https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.de.300.vec.gz \
  | gunzip -c | head -n 60001 > cc.de.300.60k.vec

# 2. The dataset: 10 games, 40k vocabulary, about a minute.
#    PYTHONUTF8=1 is needed on Windows, where the german_nouns package opens its
#    CSV in the system code page and dies on the first umlaut.
cd backend
PYTHONUTF8=1 python prepare.py \
  --fasttext ../cc.de.300.60k.vec \
  --output ../data-readme \
  --games 10 --vocab-size 40000 --start-date "$(date -d '-9 days' +%F)"

# 3. The Woerdle lists, derived from the vocabulary written in step 2.
cd ..
PYTHONUTF8=1 KONTEXTO_DATA_DIR=./data-readme python scripts/prepare-wordle-data.py
```

`--start-date` nine days back puts the daily game on number 10, the last one in
the pool. The guesses in the spec are chosen for that game's answer, so the
board in the picture spans all three colour bands. Pick another start date and
the ranks move; re-tune `GUESSES` in the spec against `/api/closest` if you do.

`data-readme/` is gitignored. The rendered PNGs are committed, the dataset is
not.

## Taking the shots

```bash
cd frontend
MSYS_NO_PATHCONV=1 NEXT_PUBLIC_API_URL=/api pnpm build
KONTEXTO_README_SHOTS=1 KONTEXTO_E2E_DATA_DIR=../data-readme \
  pnpm exec playwright test e2e/readme-shots.spec.ts
```

`KONTEXTO_E2E_DATA_DIR` points the backend that `playwright.config.ts` boots at
the screenshot dataset; without it the same stack runs on the mock. The spec is
skipped unless `KONTEXTO_README_SHOTS` is set, because `testMatch` is
`**/*.spec.ts` and it would otherwise join every `pnpm test:e2e` run.

Kill a leftover backend on port 8123 before a run. `reuseExistingServer` is on
outside CI, so a process still holding that port from an earlier session serves
the run with whatever code it loaded back then, and the failure looks like a
schema mismatch in code you never touched.

## What gets taken

| File | What it shows |
|-|-|
| `kontexto-light.png`, `kontexto-dark.png` | the daily board mid-round, both themes |
| `wordle.png` | a Woerdle board after two guesses |
| `duell.png` | a duel room with both players in the sidebar |
| `modi.png` | the mode catalogue, full page |
| `mobil.png` | the board at phone width |

Nothing is asserted about the images. The assertions in the spec only make sure
the page reached the state worth photographing before the shutter opens.
