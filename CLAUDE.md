# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Kontexto: a German semantic word‑guessing game (guess the secret word; each guess is ranked by semantic closeness), plus a **Wördle** mode, several solo rule sets, real‑time **duel**, **koop** and three timed **arena** modes, a random matchmaking queue in front of all of them, and a passkey‑protected admin analytics dashboard. Monorepo:

- `frontend/`: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui. Ships as a **static export**.
- `backend/`: FastAPI + Uvicorn, SQLite, NumPy/fastText. Serves the game API, duel WebSockets, and analytics.
- `data/`: pre‑computed game data (word rankings, vocab, Bloom filter, typo index, Wordle word lists) + the runtime SQLite DB. Generated, not in git.
- Root: Docker multi‑stage build, `docker-compose.yml` (Caddy + app), `nginx.conf`, `supervisord.conf`, `Caddyfile`, `.github/workflows/deploy.yml`.

## Commands

### Frontend (`cd frontend`): **pnpm** only (Node ≥ 24), never npm
```bash
pnpm install
pnpm dev                 # next dev (expects backend at NEXT_PUBLIC_API_URL, default in .env.development)
pnpm build               # next build → static export to frontend/out (THE primary verification gate: runs TS type-check + export)
pnpm test                # vitest run
pnpm test -- <file>      # single test file, e.g. pnpm test -- lib/blog.test.ts
pnpm test:watch          # vitest watch
pnpm seo:check           # node scripts/seo-check.mjs, asserts canonical/hreflang/H1/word-count/JSON-LD/sitemap on content pages
pnpm verify:slop         # UI patterns that read as machine-built (gradient fill, coloured shadow,
                         # transition-all, glass surface, emoji, unsourced metric, em dash).
                         # No argument = changed + untracked files; --branch = vs master; --all = whole repo
pnpm verify:dashes       # em dash (U+2014/U+2015 always, U+2013 only as a dash) across the WHOLE
                         # repo, including backend Python, Dockerfile, docs and .claude/
pnpm icons               # rasterises app/icon.svg into favicon.ico, apple-icon.png and the
                         # three manifest PNGs. Only needed after editing app/icon.svg;
                         # the outputs are committed, the Docker build does not run it
```
**Before reporting anything done:** `pnpm build && pnpm test && pnpm seo:check && pnpm verify:slop --all && pnpm verify:dashes`, plus `pytest` from `backend/` if you touched Python. The type-check alone is not enough; the export build finds more.

**And `pnpm test:e2e`, whenever `app/layout.tsx`, the game clients or anything that changes page loading is touched.** CI runs it (`.github/workflows/deploy.yml`), and it catches what the list above cannot: the suite drives the real static export against a real backend. It was left out of this list once, and a change to the AdSense loader in `<head>` went green on every check here and red in CI.

```bash
python scripts/create-test-data.py --output data-e2e     # once, mock dataset
NEXT_PUBLIC_API_URL=/api pnpm build                      # from frontend/
pnpm test:e2e                                            # boots backend + proxy itself
```

**The e2e backend needs a venv Playwright can execute.** `playwright.config.ts`
looks for `backend/.venv-win/Scripts/uvicorn.exe`, then the two POSIX layouts, then
falls back to `python -m uvicorn` (CI). A venv created inside WSL lives at
`backend/.venv` and its `bin/uvicorn` is visible from Windows but not runnable there,
which used to fail with "Der Befehl \".venv\" ist entweder falsch geschrieben". On
Windows create `backend/.venv-win` with the runtime dependencies only (fastapi,
uvicorn[standard], numpy, pydantic, pybloom_live, simplemma, aiosqlite, webauthn,
plus `tzdata`, which Windows has no system copy of).

**On Windows in Git Bash**, prefix the build with `MSYS_NO_PATHCONV=1`. Without it MSYS rewrites the value `/api` into `C:/Program Files/Git/api`, the export inlines that as the API base, and the app then fetches `file://` URLs. Every game page fails to load and the symptom looks exactly like a broken backend.

**Do not use `pnpm lint`.** ESLint 10 is incompatible with eslint-plugin-react 7.x and it crashes project‑wide (`contextOrFilename.getFilename is not a function`) on the first file, regardless of your changes. Use **`pnpm build` + `pnpm test` + `pnpm seo:check`** as the real gates until the versions are reconciled.

### Backend (`cd backend`): Python 3.12, pytest
```bash
python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
KONTEXTO_DEV=1 KONTEXTO_DATA_DIR=../data uvicorn main:app --reload   # dev API server (single process, no background tasks)
pytest                                                              # all backend tests (run from backend/)
pytest test_analytics.py::test_name                                # single test
bash ../scripts/prepare-data.sh ../data/                            # build game data (downloads German fastText, computes rankings), needed once for local dev
python ../scripts/extend-game-pool.py --help                        # grow the prod pool offline (see docs/plans/2026-09-20-mode-expansion-upload.md)
python ../scripts/rebuild-core-pool.py --help                       # rebuild the data around the core lexicon and solution_pool.txt
python ../scripts/playtest-pool.py --help                           # play sampled rounds against a running backend and report each one
```

### Full stack
```bash
docker compose up --build    # http://localhost:8080, builds frontend, prepares data, runs nginx+supervisor+uvicorn
```

## Architecture (the parts that span multiple files)

### Backend process model
`main.py` is one FastAPI app run as **two roles** (see `supervisord.conf`): **4 API workers** (`:8000`) and **exactly one WebSocket worker** (`:8001`, started with `KONTEXTO_WS_MODE=1`). Five background loops run **only in the WS worker** (single writer, no races): analytics aggregation/pruning plus room cleanup and queue pruning (every 5 min), the duel/koop/wordle‑duel poll‑and‑broadcast loops, the **arena clock** (`arena.advance_due_arenas`, every 1 s, applies every deadline that has passed) and the **matchmaking loop** (`matchmaking.run_matchmaking`, every 1 s, forms parties). There is no in‑process shared state between workers: **SQLite is the single source of truth**, so all writes must be idempotent (HLL `MAX`‑upserts, daily upserts) because multiple workers write concurrently (WAL, 5 s busy timeout).

### Game engine (the core mechanic is pre‑computed)
There is **no live embedding inference at request time**. `prepare.py` (offline / build step) loads the German fastText model, debiases vectors (remove mean + top‑3 PCs), computes cosine similarity to each target, and writes per‑game rank arrays to `data/games/{NNNN}.npz`, plus `vocabulary.json`, `lemma_map.json`, `bloom.bin`, `core_words.json`, `target_words.json`, `metadata.json`. At runtime `game.py` does an O(1) dict/array lookup `word → rank`. Wordle uses `data/wordle/{solutions,valid_words}.json`.

**The core lexicon decides what a rank counts (`core_lexicon.py`, since 2026-09-21).** The vocabulary is a frequency cut of 80.000 word forms and only a fifth of it is language anybody uses; measured over 200 games, just 78 of the 500 nearest words were everyday words and the 50th best everyday word sat at displayed rank 302. So a second, smaller list ships next to it: **15.517 core lemmas**, Zipf ≥ 3.2, one base form per word (three gates: `lemma_map`, simplemma, and HanTa for the participles the other two miss), name tokens kept because they are ordinary nouns too. Two consequences, both in `game.py._display_scale`: the **debias is fitted on the core** and then applied to the whole vocabulary (`prepare.postprocess_vectors(fit_words=…)`), and the **displayed rank counts core words only**, so `guess`, `tip` and `closest` all run on that scale and `total` is the core size, not `vocab_size`. **Nothing is refused**: a word outside the core still scores, sharing the number of the nearest core word ahead of it plus one, capped at the core size, which also keeps rank 1 unique to the solution. A data directory without `core_words.json` (an older volume, the Wordle data, a test fixture) ranks over the whole vocabulary exactly as before. **The solution always counts**, whatever the core list says, because otherwise the nearest core word would take displayed rank 1 and a client would call the round solved on the wrong word; the pool builder keeps every solution in the core and aborts if one is missing, and `_display_scale` guards it a second time. Measured against the deployed scale on 80 identical solutions: median 45,5 guesses → 35,0, all 80 solved instead of 78, rounds over 80 guesses 12% → 4%.

**What may be a solution**: the live pool is the hand-curated list in **`backend/data/solution_pool.txt`** (2.697 words, about 7,4 years of daily puzzles), and `scripts/rebuild-core-pool.py` builds the data from it. Two automatic gates and one human one. Automatic and reproducible: the word is a core lemma, and `TargetWordFilter` accepts it as a common noun that the dictionary lists as a lemma, with no proper name, no inflected form and nothing from the profanity list. Human and not reproducible: every candidate was read against a written rubric, and `backend/data/solution_rejects.txt` records what was struck and under which code.

**The original's selection curve, reconstructed (2026-09-22).** Sorted into
frequency bands of the English word list, the 1.461 published Contexto answers
show what that game does: it takes 11,8% of the first 500 words, peaks at 17,4%
between rank 500 and 1.000, then falls off geometrically to 1,3% at rank 16.000
and 0,008% past 64.000. It is not a frequency cut with a hard edge and not a
uniform draw over a vocabulary, it is a weighting, and missing that is why the
old pool sat at median rank 13.606 where the original sits at 5.889.
`scripts/generate-pool.py` reproduces that shape: it collects every eligible
German noun up to rank 64.000 through the project's own gates
(`scripts/build-solution-pool.py`), gives each band the share the original
gives it, and fills each band with the words of best **foothold**, so the curve
decides the shape and the foothold keeps it easy.

**What the reconstruction proved, and its limit.** The curve cannot be filled
in German. Of the 500 most frequent German words only 39 are nouns our gates
accept, and of the top 2.000 only 281, because German's frequency top is
particles, verbs and abstract nouns. A pool that follows the curve exactly
therefore stops at 2.229 words with a median rank of 8.899, and the deep bands
the curve still asks for can only be filled with administrative German
(`amtsblatt`, `bezirksamt`, `schulbehörde`, `erwerbstätigkeit`). So the shape
is followed where the language allows it: 57 of the 245 words the generator
proposed were taken, the other 188 refused under code `S`. The gap that remains
is the language, not the method.

**The simulated player is wrong about abstract words too (2026-09-22).** It
ranked the pool cleanly by concreteness, AbstConc 6,5 and up at a median of 39
guesses against 52 below 4,5, and playing the original's own 77 answers in
German gave median 50 with 18% of rounds over 80. On that evidence 1.007 words
were struck, and the evidence was wrong. The model's neighbours for those words
are good (the word for order returns disorder, cleanliness, chaos, harmony,
structure), and the decisive measurement is blind: take the 500 most frequent
core words, which is what a player types before they have a direction, and ask
which ranks best. For concrete solutions the median best rank is 95, for
abstract ones **29**. An abstract solution is easier to get a foothold on, not
harder; the bot simply never tries "chaos" for the word for order because its
neighbour walk goes elsewhere. The words were restored. This is the same failure
that struck out the words for camera, clock, nose and Christmas, now written
down for a third class. **Do not use the bot as a per-word veto.**

**The model was put out to tender and kept (2026-09-22).**
`scripts/benchmark-embeddings.py` runs every candidate against five measures
without recomputing a single game: the SemEval-2017 German gold standard, the
foothold, string contamination, a polysemy trap and the player from
`playtest-pool.py` run offline. Measured: fastText 0,807 correlation and 41
guesses with 7,5% of rounds over 80; ConceptNet Numberbatch wins the gold
standard at 0,839 and plays at 51 guesses with 26%; our own retrofit against
OpenThesaurus reaches 0,830 and plays at 50 with 14%; the 2024 sentence
transformers (BGE-M3, multilingual-e5, Model2Vec) land between 0,45 and 0,52
and play at 64 to 69 guesses with 36 to 43%. They are trained to retrieve
passages, so a bare word is out of distribution and they fall back on subword
overlap. **Two lessons written down: the academic score is not the game**, since
the two models that win the correlation both lose the play test by pulling
synonyms into tight clusters a player then circles inside; and **nothing moves
the abstract words**, not any model, not any retrofit strength, and not a
greedy optimisation of the opening words that cut the median foothold from 191
to 116 without changing play at all. Training our own on a Wikipedia crawl
would use less data than `cc.de.300` already saw.

**The foothold is the per-word gate (reject code `F`).** It is the best rank any
of the twenty opening words reaches for a solution: deterministic, one matrix
row, and unlike the simulated player it cannot get stuck, which is what made
the player useless as a veto. Validated against 600 live rounds, Spearman
0,614: a foothold under 50 plays at 33 guesses with no round over 80, one over
1.200 at 75 guesses with 34%. The pool is cut at 400, which is the knee of the
curve, and `backend/data/solution_protected.txt` holds every word the player
ruled on by hand, restored after all automatic gates, because a measured gate
is wrong often enough that a human ruling has to outrank it.

**Every game is played before a pool ships**, not a sample: `playtest-pool.py`
with `--rounds` set to the whole range. On the current pool that is 2.665
rounds at 99,5% solved, median 40 guesses and 5,3% over 80. The 14 the player
never solves are its blind spot and stay in: short, polysemous words such as
the ones for hammer, sack and wool, which a person types in the first minute.

Still worth measuring some day: subtitle frequencies (SUBTLEX-DE) instead of
wordfreq, because subtitle counts predict word recognition speed far better
than web text, and spaCy instead of HanTa for the word-class gate.


**The simulated player is not a gate on single words, and the attempt is written down so it is not repeated.** `scripts/playtest-pool.py` measures how the pool plays as a whole and is good at that. As a per-word veto at 80 guesses it struck out the words for camera, clock, nose, cinnamon, Christmas, quark, wool and courgette: it walks from neighbour to neighbour, so a short, polysemous or semantically isolated word defeats it while a person types it in the first minute. Concreteness scores have the same limit in the other direction, and they put the words for ash tree, amber and moth into the pool. Both are hints for the reading pass, never the decision.

**The filter behind the list (`target_selection.py`)**: since 2026-09-21 a Kontexto solution is a **concrete common noun**, nothing else. Verbs and adjectives stay legal guesses, they just stopped being answers. Two gates carry the rule, both on by default and both switched off explicitly by the scripts that maintain the older pools: `nouns_only`, and `require_concrete`, which checks `data/concrete_nouns.txt` (derived from the German affective norms by `scripts/build-concreteness-list.py`; the 6 MB source is never committed). The reason is measured, not asserted: on production, a solution the norms rate below 4.0 costs 118 guesses per solve and one at 7.0 or above costs 48, while whole frequency bands differ by barely a third. That is also why the frequency floor is only Zipf 2.5: a rare but picturable word (`maiskolben`, `pelikan`, `streichholz`) is a better round than a frequent abstract one. `data/unfair_targets.txt` holds what no automatic gate catches, written down by heading from reading every proposed solution by hand. Details and the numbers: `docs/plans/2026-09-21-concrete-noun-pool.md`.

**Typo correction (`spellfix.py`)**: a guess that is not a known word is not rejected right away. `prepare.py` also writes `data/spell_index.npz`, a symmetric-delete (SymSpell) index over every surface form (vocabulary word plus inflected form from the lemma map), stored as sorted 64-bit hashes plus word ids, around 25 MB in memory and 0,05 ms per lookup. The rules are deliberately narrow: a known word is never rewritten, written-out umlauts (`haeuser`, `strasse`) always resolve, a single candidate at edit distance 1 in a word of at least 5 characters is scored with `corrected_from` set, and anything else comes back as a 404 with up to three `suggestions` the player can tap. Candidates are ordered by edit distance and German word frequency, **never** by their rank in the running game, which would turn the correction into a free hint. Two typos in one word are out of scope. A data volume from before this feature gets its index from `scripts/build-spell-index.py`, which the Docker entrypoint runs; without it each worker builds its own on the first mistyped guess (1,6 s).

### API surface (all under `/api`, defined in `main.py`, logic in `game.py`/`duel.py`/`koop.py`/`arena.py`/`matchmaking.py`/`wordle.py`/`wordle_duel.py`)
- Kontexto: `guess`, `tip`, `game`, `games`, `reveal`, `closest`. `guess`/`tip`/`reveal` take an optional `mode` (validated against `analytics.SOLO_MODES`) so the solo modes are counted apart.
- Solo modes: `word-at-rank` (Leiter's opening word, never rank 1), `dual/next` + `dual/guess` (Doppelziel, both ranks in one request), `sudden-death` (a game plus its runners‑up).
- Duel: `duel` (create), `duel/{id}/join|guess|history|tip|reveal`, `duel/player-info`, `GET duel/{id}` (state); realtime `WS /ws/duel/{id}?token=…`.
- Arena (Battle Royale, Blitz‑Duell, Zeitbonus‑Jagd): `arena` (create), `arena/{id}/join|start|guess|history|next-game|reveal`, `arena/player-info`, `GET arena/{id}`; realtime `WS /ws/arena/{id}?token=…`.
- Matchmaking: `matchmaking/enqueue|status|cancel`. One queue for duel, koop, wordle‑duel and the three arenas.
- Modus-Beliebtheit: `GET modes/popular`. Names the most-picked mode per tab of the picker (`solo`/`friends`/`strangers`), never a figure. A pick is counted where a player commits: the first guess of a solo round (rides along with `starts`, so it is deduped per fingerprint and game), a created room, a queue ticket. One counter metric `mode_picks`, dimension `<group>:<mode>` so the same mode on two tabs stays two decisions. A group is `null` below `POPULAR_MIN_PICKS` in 30 days and on a tie, and then carries no badge. Cached 5 min per API worker; the client freezes the order for the length of one opening (`lib/popular-modes.ts`), because a row that climbs to the top after the dialog is open moves the row under the finger.
- Wordle + Wordle duel: mirror of the above under `/api/wordle/…` and `WS /ws/wordle/duel/{id}`.
- Analytics: `collect/token`, `collect` (pageview, optional `share` marker), `collect/heartbeat` (presence + attention when the tab is visible), `collect/share` (share button pressed), `stats/complete` (client completion histograms), `survey/answer` (attribution survey, one answer per fingerprint).
- Admin: `admin/webauthn/{login,register}/{options,verify}`, `GET admin/stats`.

### The room boundary: a game number is the answer (`rooms.py`)
`reveal`, `closest` and `wordle/reveal` serve the target word for **any** game number to **anybody**, and that stays so: a solo player may spoil their own game. In a room the same number is the opponent's puzzle, so one number plus one open endpoint is a working cheat. Hence, since 2026-09-21: a room is created with a **selector** (`game_source: "today" | "random"`, `extra="forbid"` so a client-supplied `game_number` is a 422) and the server picks; **no room response and no socket frame carries `game_number` or the target while the round is open** (the state models strip it, `_public_arena_state` strips the arena frame by hand, the `next_game` frames became `next_round` + `round`); clients key their board resets on `round`. The number comes back with the word from `POST {mode}/{id}/reveal`, token-checked, once the **caller's own** round is over: duel = this player solved, koop = team solved or gave up, arena = arena finished, wordle duel = solved or six guesses used. A refusal is 409 `round_open` (404 for an unknown room or a foreign token) and says nothing more, because a message that distinguished "not yet" from "not you" would be a probe. Held by `backend/test_room_secrecy.py` and `frontend/lib/room-secrecy.test.ts`.

Duel realtime is **DB‑polling broadcast** (`websocket_manager.py`): the WS worker polls the players table every second and pushes diffs (`player_joined`/`rank_update`/`player_solved`/connect‑state) to all sockets in that duel.

### Arenas and the clock (`arena.py`)
Battle Royale, Blitz‑Duell and Zeitbonus‑Jagd share one table triple (`arenas`/`arena_players`/`arena_guesses`); they differ only in how a deadline is set and what happens when it passes. **The server owns time.** Every deadline is an absolute UTC timestamp written in `arena.iso_timestamp` (fixed width, so SQLite's string comparison is a time comparison) and shipped to the client together with `server_time`, which the client uses to correct its own clock. The guess path refuses a late guess itself (409 `time_up`), so the buzzer cannot be beaten inside the evaluator's one‑second window. Every transition in `advance_due_arenas` is guarded by the state it expects (`WHERE status = 'running' AND deadline_at <= ?`), so a repeated pass is a no‑op.

### Matchmaking (`matchmaking.py`)
One `matchmaking_queue` table in front of every multiplayer mode. A table and not process memory, because the five workers share nothing else. Pairing runs in the WS worker and claims tickets under `matched_room_id IS NULL`. The nickname rule is not the queue's own; it is `nicknames.sanitize_nickname` and every room runs it, invite links included (see below).

### Nicknames and the word filter (`nicknames.py`, `wordlists.py`)
A name is the only free text the game has, everyone in the room reads it, and an invite link
gets forwarded, so **one rule guards every door**: `sanitize_nickname` runs in `create_*` and
`join_*` of duel, koop, arena and wordle‑duel as well as in `matchmaking.enqueue`. It is
idempotent, because the matchmaking path sanitizes and then hands the name to a room
constructor that sanitizes again.

An abusive name is **not rejected, it is reflected**: whoever types `Hurensohn` plays as
`Ich bin H*******n`. The mask is built from the blocklist entry, never from the typed spelling,
so `HURENSOHN`, `hur3nsohn` and `xxHurensohnxx` all produce the same name. Nothing tells the
player the filter fired. A rejection with a message is a probe (type, read the error, adjust);
a silent rename gives nothing to calibrate against. The frontend needs no change for this: every
client already reads the name back from the server (`player-info` or the join response).

**Two lists, two questions.** `SOLUTION_BLOCKLIST` (hand‑maintained, exact match) answers
"may this word be the puzzle's answer" and stays narrow on purpose: `Schwanz`, `Sack`, `geil`
and `blasen` remain solvable homographs. The tiers under `backend/data/` answer "may a user
write this" and are built on the vendored LDNOOBW German list (622 entries, CC0,
`profanity_de_raw.txt`). Letting the big list decide the first question would ban harmless
puzzle words.

**The user‑text list has two tiers, because German compounds.** `profanity_de_strict.txt` is
matched as a substring, which is how a word list gets evaded (`arschgeige1`, `xxfotzexx`).
`profanity_de_word.txt` is matched only as a whole token, for entries that sit inside ordinary
German (`mist` in `Mistel`, `after` in `Botschafter`, `puff` in `Auspuff`).
`profanity_de_allow.txt` holds the legitimate words that carry a strict term inside them
(`marsch`, `mongolei`, `broschure`) and is removed from the text before the scan.
`profanity_de_ignored.txt` documents every raw entry this project does **not** enforce, with the
reason; `Nilpferd`, `Ecke` and `Druck` are not insults, and neither are `schwul`, `homo` or
`lesbe`, while the slurs built on them (`schwuchtel`, `kampflesbe`) stay. Which entry belongs
where is measured, not guessed: `scripts/classify-profanity-list.py` scans the list against
wordfreq's 50.000 most frequent German words plus `backend/german_names.txt` and prints the
collisions. Run it after any list update.

Matching happens over a normalised form that survives leetspeak (`f1ck`), Unicode confusables
(a Cyrillic `а` in `аrsch`), zero‑width characters, combining marks and stretched
letters (`aaarsch`). The survey free text uses the same engine with `collapse_words=False`, so
tokens stay separate and "Star Schule" does not read as profane.

### Analytics (cookieless, server‑authoritative, `analytics.py`)
Authoritative counts (guesses/solves/hints/reveals/duels) are incremented **server‑side from the real handlers**, never trusted from the client. Visitor identity is an anonymous, non‑reversible fingerprint `SHA256(IP + UA + monthly salt)` folded into **HyperLogLog** sketches (all‑time + monthly) for unique‑visitor estimates. Raw `analytics_events` are kept **35 days** then pruned; permanent rollups live in `analytics_daily`/`analytics_counters`/HLL tables. Only the completion **distribution histograms** come from the client (`stats/complete`), token‑gated + bot‑filtered + deduped. The attribution survey („Woher kennst du Kontexto?", `survey/answer`) follows the same pattern: the countable answer is a permanent counter (`survey_source_v1`), the dedup ledger `analytics_survey_seen` is kept 180 days, and the optional free text lives in `analytics_survey_details` **without** a fingerprint. Frontend side: `lib/survey.ts` (catalogue, shuffle, frequency caps), `components/SourceSurvey*.tsx`. Three further growth signals share the same posture: `starts` (counted once per fingerprint, mode and game via `analytics_start_seen`, triggered by the `first` flag on the opening guess, which is only a hint because the ledger caps it), `shares` plus `share_arrivals` (the share text carries `?s=<game>`, the marker is counted per page and stripped from the address bar on arrival) and `attention` (one heartbeat of a visible tab = `HEARTBEAT_SECONDS`). Heatmap/peak‑hour stats are bucketed in **`DISPLAY_TZ = Europe/Berlin`** (`analytics.py`).

### Admin auth (`auth.py`)
A single **WebAuthn passkey** protects `/admin`. Login issues an HMAC‑signed session token (12 h TTL, `Authorization: Bearer …`). Registration is **break‑glass**: disabled unless `KONTEXTO_ADMIN_ENROLL_TOKEN` is set. Brute‑force protection is per‑IP (in‑memory) + global (DB). All HMACs (fingerprint salt, beacon tokens, session/WebAuthn tokens) derive from one secret in `server_secret.py` (fail‑closed in prod).

### Frontend
Static export (`next.config.ts`: `output:"export"`, `trailingSlash:true`). Dynamic room URLs (`/duel/<id>/`, `/koop/<id>/`, `/wordle/duel/<id>/`, `/arena/<id>/`) render the single matching page and read the id from `window.location.pathname`; in prod nginx does the `try_files … /duel/index.html` fallback, in dev `next.config.ts` adds `rewrites()` and `e2e/serve.mjs` mirrors both. One `/arena/` route serves all three arena modes, because the mode comes from the room state and does not need to be in the URL. Solo modes live at `/solo/{leiter,limit,doppelziel,sudden-death}/`, the queue at `/suche/`, the catalogue at `/modi/`; `lib/solo-modes.ts` and `lib/multiplayer-modes.ts` are the single source for a mode's name, pitch and rules. Client state is plain `useState`/`useEffect` + `localStorage` (no SWR/React Query); keys are prefixed `kontexto_*` / `wordle_*`. Theme is read by an inline script in `app/layout.tsx` before hydration to avoid a flash. API access goes through `lib/api.ts` / `lib/duel-api.ts` / `lib/wordle-api.ts` (base = `NEXT_PUBLIC_API_URL`, fallback `/api`; errors thrown as coded strings like `"unauthorized"`), and the two WS hooks `lib/use-duel-websocket.ts` / `lib/use-wordle-duel-ws.ts`. recharts is loaded via `next/dynamic({ ssr:false })` (`app/admin/stats/page.tsx`) so it stays out of the main bundle. Keep dashboard/skeleton code free of static recharts imports. UI text is German throughout; de‑DE formatting helpers live in `lib/format.ts`.

### Designsystem (`app/globals.css` + `components/design/`)
Seit 2026-09-21 gibt es ein Tokenfundament, und neue Oberfläche wird daraus gebaut, nicht daneben.
**Typografie:** acht Stufen, `text-micro` bis `text-display`. `text-xs`…`text-4xl` und freie
Pixelwerte sind raus (Ausnahme: SVG-Diagramme unter `components/content/`, dort ist die Größe
Geometrie). Zwei Schriften: Figtree (`font-sans`) für alles Laufende, Bricolage Grotesque
(`font-display`) für `h1`–`h3` und Zahlen-Helden; die Zuweisung an die Überschriften steht einmal
im `@layer base`. **Farbe:** Tintenblau als `--primary` in beiden Modi (kein shadcn-Grau-Flip),
dazu drei getrennte Familien, die nie vermischt werden: `--rank-{near,mid,far}` (wie nah ist der
Tipp, Emoji-kompatibel und deshalb festgelegt), `--success`/`--warning`/`--info` (hat es
funktioniert) und `--tile-*` (Wördle). Jede hat eine Füllung und eine `-ink`-Variante für Text.
Rohe Tailwind-Stufen wie `bg-green-500` gehören nicht mehr in `app/` oder `components/`.
**Fläche:** `components/design/Panel.tsx` ist die eine Karte (`tone`, `padding`, `asChild`), gebaut
auf `components/ui/card.tsx`. **Erhebung, eine Regel:** Panel = Füllung plus Haarlinie ohne
Schatten, Overlay = Schatten ohne Kante. Weitere Primitive: `Stat`/`StatRow`, `Meter` (der
Ratebalken für alle Modi), `ResultHero` und `ResultList`/`ResultRow` (alle fünf Ergebniskarten),
`Wordmark`. Kontrast ist gemessen, nicht behauptet: `e2e/design-audit.spec.ts` hinter
`KONTEXTO_DESIGN_AUDIT=1` prüft 19 Farbpaare je Theme gegen 4,5:1 und legt Screenshots in
`.checks/`. Details und die Begründungen: `.claude/rules/frontend/no-slop.md`, Abschnitt
„Designsystem“.

**Das Zeichen** ist der Ring aus `components/design/Wordmark.tsx`, und es steht genau einmal als
Vektor in `frontend/app/icon.svg`. Favicon, Apple-Touch-Icon und die drei Manifest-PNGs entstehen
daraus durch `scripts/build-icons.mjs` (`pnpm icons`), damit sie nicht wieder auseinanderlaufen:
vor dem Redesign stand eine grüne Verlaufskachel mit einem „K“ im Tab neben dem tintenblauen
Ring im Kopf der Seite. Die Strichstärke des Icons ist bewusst leichter als die der Wortmarke,
begründet in der Datei selbst. Die Ableitungen sind eingecheckt, der Docker-Build ruft das Skript
nicht auf. Das Teilen-Bild (`app/opengraph-image.tsx`) zeigt dieselbe Wortmarke; Satori kommt nicht
an die Schriften von `next/font/google`, deshalb liegen die beiden Schnitte als TTF unter
`frontend/assets/fonts/`, mit der Begründung im README daneben.

**Farbwelten** (`lib/palette.ts`, `lib/use-palette.ts`, `components/PalettePicker.tsx`): die
Akzentfarbe ist einstellbar, unabhängig von hell und dunkel. Fünf Stück, `tinte` (Vorgabe),
`beere`, `indigo`, `petrol` und `klassisch` (das Grau von vor dem Redesign). Eine Farbwelt
ändert **nur Farbe**: Radius, Skala, Schrift und Aufbau sind in allen gleich, sonst wäre es ein
zweites Frontend. Die Werte stehen in `app/globals.css` unter `[data-palette="…"]` plus
`.dark[data-palette="…"]`; das Attribut setzt `PALETTE_SCRIPT` inline im `<head>`, sonst blitzt
beim Laden die Vorgabe auf. **Die Rang-Rampe wird nie überschrieben**, weil der geteilte
Ergebnistext sie als Emoji-Quadrate buchstabiert; nur `--rank-track` und `--rank-foreground`
wandern mit. Achtung bei neuen Farbwelten: `.dark` und `[data-palette]` haben dieselbe
Spezifität, eine Farbwelt braucht deshalb **immer beide Blöcke**, auch die Vorgabe. Geprüft von
`e2e/palette.spec.ts` und vom Kontrastlauf in `e2e/design-audit.spec.ts`, der alle fünf in beiden
Modi misst.

**Bewegung:** vier Stellen bewegen sich, jede an ein Ereignis gebunden. `Meter` fährt die Breite
eines neu geratenen Worts an (CSS-Keyframe `meter-run` mit **nur einem `from`**, damit die
Endbreite im Inline-Style steht und ohne JavaScript und unter `prefers-reduced-motion` stimmt),
`RevealWord` baut das gelöste Wort buchstabenweise auf, `CountUp` zählt die Aufschlüsselung hoch,
`OpeningDemo` spielt im Leerzustand einmal die Mechanik vor. Reihenfolge beim Lösen: Balken fährt
an, dann Karte (`result-in`), dann Konfetti. Die beiden JS-getriebenen Stücke fragen
`useReducedMotion()` selbst, weil der globale CSS-Block sie nicht erreicht, und tragen den
Endzustand vom ersten Rendern an im DOM. Doppelt geprüft in `e2e/motion.spec.ts`: dass es sich
bewegt, und dass es das bei `reducedMotion: "reduce"` nicht tut.

### shadcn/ui: the full set is vendored
`frontend/components/ui/` holds **every component the shadcn registry offers** (53 files),
not only the ones in use. They are vendored source, not a dependency, so an unused file
costs a file and nothing in the bundle, and having them present means a new surface is
built from the design system instead of from hand-rolled markup. Add a missing one with
`pnpm dlx shadcn@latest add <name>`; `--all` currently fails on a broken registry entry
(`questionnaire`), so pass an explicit list.

Two things bite after any `shadcn add`:
1. **It reintroduces `transition-all`.** Run `pnpm verify:slop --all` and name the property
   that actually changes. Eight components needed this on the initial sweep.
2. **`--overwrite` silently reverts deliberate edits.** It wrote `import { cn } from "cn"`
   into all 50 files (wrong path, build-breaking), pulled `next-themes` into `sonner.tsx`
   (this project has no next-themes) and reset the enlarged touch targets in
   `dropdown-menu.tsx` and the dialog width in `dialog.tsx`. Never overwrite a component
   the project has already touched; check `git diff components/ui/` afterwards.

### SEO layer (a deliberate hybrid, don't regress it)
Content/SEO pages use **JS‑free primitives** (`components/seo/SeoPrimitives.tsx`, `SeoFaq.tsx` built on `<details>`) so all content is crawlable in the static HTML. **Framer Motion** (`motion` package via `components/motion/MotionProvider.tsx`, `LazyMotion` strict + `MotionConfig reducedMotion="user"`) is layered **only as progressive enhancement**, never as the source of content. Per‑page metadata + self‑canonicals + hreflang come from `lib/seo.ts` (`buildMetadata`); JSON‑LD from `lib/structured-data.ts`; `app/sitemap.ts` + `app/robots.ts` are dynamic; the blog is MDX with an **explicit static loader map** in `app/blog/[slug]/page.tsx` (template‑literal dynamic imports break under static export).

### Deployment
Push to **`master`** is the deploy: `.github/workflows/deploy.yml` runs `pytest`, then SSHes to `/opt/kontexto` and runs `docker compose up --build`. The Dockerfile is multi‑stage (build frontend → prepare data → runtime image with nginx + supervisor + uvicorn). Caddy terminates HTTPS in front. Health checks hit `/api/game` and `/api/collect/token`.

## Rules & gotchas

- **pnpm only** for the frontend (Node ≥ 24). The frontend is built **without a running backend** (Dockerfile stage 1), so **never add build‑time fetches to the backend**. Daily‑solution/archive pages and AggregateRating stars were removed for exactly this reason. If you need backend data at build time, generate it from `data/` files instead, or build against a running backend.
- **Lockfile discipline:** the `@types/react` version must match across `frontend/package.json`, the `pnpm-workspace.yaml` overrides, and `pnpm-lock.yaml`, or clean Docker CI fails with `ERR_PNPM_OUTDATED_LOCKFILE` (a local frozen install can mask it). Verify a change with `rm -rf node_modules && pnpm install --frozen-lockfile`.
- **`KONTEXTO_SERVER_SECRET` must stay stable forever**. Changing it resets unique‑visitor counts and invalidates all admin sessions. Prod refuses to start without it; for local dev set `KONTEXTO_DEV=1` instead.
- **Background tasks live in the WS worker only** (`KONTEXTO_WS_MODE=1`). Don't assume aggregation/cleanup runs in API workers. Keep all DB writes idempotent, because multiple workers write the same SQLite file.
- **Analytics:** never make authoritative metrics client‑trusted; only distributions come from the client, and always token‑gated + bot‑filtered + deduped.
- **Content conventions:** German UI, **no emojis** in content, and aim for production‑ready, best‑practice work on the first pass (no MVP/iterative shortcuts, see the global guidance in `~/.claude/CLAUDE.md`). `frontend/lib/legal.ts` holds the real Impressum data (a booked c/o address service, second contact path per § 5 DDG, responsible person per § 18 MStV); the private home address is deliberately not published. Typography is enforced: no em dash (U+2014), German quotes `„…“` only, and en dash only in numeric ranges. `pnpm seo:check` fails the build on violations, on unbalanced quotes, and on any blog post under the internal 1,200-word regression guard, and `pnpm verify:dashes` holds the same typography rule across the whole repo. The word threshold is not a Google minimum. Rule: `.claude/rules/content/no-em-dash.md`.
- **No AI slop in the UI:** no gradient as a fill, no coloured shadow, no `transition-all`, no springy hover, no glass surface outside an overlay, no emoji in visible text, no `<div onClick>` without keyboard access, no `any`, no unsourced metric. **Slop is the absence of a decision**, so a deliberate exception gets a reason on the line: `// slop-ok: M8 <why this pattern is right here>` (in MDX: `{/* slop-ok-datei: M20 <why> */}`). Without a reason of at least eight characters the comment does not count. Rule: `.claude/rules/frontend/no-slop.md`, check: `pnpm verify:slop`, catalogue: skill `augenmass`. Note that a fresh `shadcn add` reintroduces `transition-all` into `components/ui/*`, so run the check after one.
- **Browser work runs as a script, never through a browser MCP:** no browser MCP server is configured for this repo (the `playwright` one was removed on 2026-09-14). It attached the page's full accessibility snapshot to every action result, five-figure token counts per click. Drive Chromium through `@playwright/test`, which `frontend/` already depends on: `pnpm test:e2e` for the suite, a throwaway script under `frontend/e2e/` for a one-off look. Headless, measure first, write screenshots to disk and open a PNG only when a written finding needs the image.
- **Standing SEO goal:** kontexto.de should out‑rank the competitor kontexto.app. Preserve the crawlable static content, self‑referencing canonicals, hreflang, JSON‑LD, and full sitemap. These were hard‑won, don't regress them.

## Quality skills (project copies under `.claude/skills/`)

### Text quality
The **`klartext`** skill rewrites text so it does not read as language-model output, with separate
catalogues for German and English and its own rule set for UI strings
(`.claude/skills/klartext/references/microcopy.md`: toasts, errors, confirmations, form of
address). It complements `no-em-dash.md` and `verify:dashes`, it does not replace them. The
measured baseline for this repo is at the end of `.claude/skills/klartext/SKILL.md`: the form of
address is "du" throughout (610 occurrences, zero "Sie"), and one deliberate deviation from the
skill is recorded there, namely that a game may celebrate in a success message but never in an
error message.

### Design quality
The **`augenmass`** skill de-slops surfaces: it carries the named patterns by which a surface
becomes recognisable as machine-built, each with the column saying when the hit is a false alarm.
Its premise is the reason for the `slop-ok` convention: slop is the absence of a decision, so the
check does not test the pattern, it tests whether a reason stands next to it. Rule
`.claude/rules/frontend/no-slop.md`, check `pnpm verify:slop`, measured baseline 9 findings on
adoption and 0 after the cleanup (2026-08-20). A second, screenshot-based pass over the prod build on the same day
found and fixed six more findings the script cannot see, among them a gradient fill written as an
inline `style` (M1 only matches Tailwind classes) and the FAQ list rendered twice on the home
page; the findings and the deliberate non-changes are listed in the rule under „Durchgang am
Bildschirm". `app/globals.css` carries a global `prefers-reduced-motion` block (durations near
zero, not `animation: none`, so `forwards` animations jump to their end state), with
`.animate-spin` as the single documented exception; Framer Motion is bound separately via
`MotionConfig reducedMotion="user"`.

## Env vars

- Backend: `KONTEXTO_SERVER_SECRET` (required in prod), `KONTEXTO_DATA_DIR` (default `data`), `KONTEXTO_DEV`, `KONTEXTO_FORCE_GAME`, `KONTEXTO_WEBAUTHN_RP_ID` / `KONTEXTO_WEBAUTHN_ORIGIN`, `KONTEXTO_ADMIN_ENROLL_TOKEN`, `KONTEXTO_TRUSTED_PROXY_HOPS`, `KONTEXTO_WS_MODE`. See `.env.example`.
- Frontend (inlined at build time): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AD_SLOT_*` (AdSense slots; unset slots render nothing), and `NEXT_PUBLIC_ADSENSE_REVIEW_MODE` (defaults to true and blocks all manual ad slots until explicitly set to `false`). See `frontend/.env.development` and `frontend/lib/adsense.ts`.
