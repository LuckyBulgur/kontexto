# Mode expansion (solo modes, arenas, matchmaking, larger game pool)

Branch: `feat/mode-expansion`. Local commits only, never pushed.

## Why

Kontexto today offers the daily game, endless mode, duel, koop, Wordle and Wordle duel.
Every multiplayer room needs an invite link, so a visitor who has nobody to invite cannot
play against anyone. The solo side has one rule set, so a returning player sees the same
mechanic every day. This change adds four solo rule sets, three timed multiplayer arenas,
one random matchmaking queue in front of every multiplayer mode, a discovery page for the
modes, and a much larger pre-computed game pool so all of that does not start repeating
solutions.

## Baseline (verified in the repo, not assumed)

- `backend/game.py` resolves a guess with an O(1) lookup into `data/games/NNNN.npz`. There is
  no embedding inference at request time, so every target must already exist in the pool.
- `backend/duel.py`, `backend/koop.py`, `backend/wordle_duel.py` are three near-parallel CRUD
  modules over three near-parallel table triples in `backend/database.py`.
- `backend/websocket_manager.py` holds three managers, each polling SQLite once per second and
  broadcasting diffs. They run only where `KONTEXTO_WS_MODE` (or `KONTEXTO_DEV`) is set
  (`backend/main.py` lifespan), alongside `_cleanup_loop`.
- `backend/analytics.py` gates mode strings in `record_completion` (line ~773) and
  `record_share_click` (line ~882) against hard-coded tuples. New modes must be added there.
- Frontend is a static export. `components/GameClient.tsx` owns the whole solo game and
  already carries endless mode. `components/Header.tsx` owns the three-dot menu.
- `scripts/regenerate-future-games.py` is the precedent for offline data work: pull prod data
  read-only, reproduce prod's vocabulary and past npz bit-for-bit as a fidelity gate, write
  only the artifacts to upload.
- Local `data/` is the 10-game test dataset, not prod data.

## Phases

Each phase ends with its own verification and its own local commit.

### Phase 1: solo rule sets (backend support)
- [x] `GET /api/word-at-rank` returns the word at an exact rank of a game (feeds Leiter).
- [x] `GET /api/dual/next` returns two distinct non-daily game numbers.
- [x] `POST /api/dual/guess` returns both ranks for one word.
- [x] `GET /api/sudden-death` returns a game plus its words at ranks 2 to 6.
- [x] New mode ids accepted by analytics: `leiter`, `limit`, `doppel`, `suddendeath`.
- [x] Tests in `backend/test_game.py` / `backend/test_api.py`.

### Phase 2: solo rule sets (frontend)
- [x] `lib/solo-modes.ts`: mode catalogue plus the pure rule engines.
- [x] `GameClient` takes a `mode` prop; mode chrome lives in `components/solo/`.
- [x] Routes `/solo/leiter/`, `/solo/limit/`, `/solo/doppelziel/`, `/solo/sudden-death/`.
- [x] One `kontexto_*` storage key per mode in `lib/storage.ts`.
- [x] Vitest coverage for every rule engine: win, loss and (where it applies) timeout.

### Phase 3: arenas (Battle Royale, Blitz-Duell, Zeitbonus-Jagd)
- [x] `arenas` / `arena_players` / `arena_guesses` tables in `backend/database.py`.
- [x] `backend/arena.py`: CRUD plus the three rule sets.
- [x] `ArenaConnectionManager` in `websocket_manager.py`, and the deadline evaluator that
      runs only in the WS worker. Every transition is idempotent
      (`UPDATE ... WHERE status = 'running' AND deadline_at <= ?`).
- [x] Deadlines are absolute UTC timestamps written by the server. Guess endpoints reject a
      late guess with 409 `time_up`.
- [x] Royale: up to 8 players, elimination phases 180, 120, 90, 60, 45, 30 seconds, then 30.
- [x] Blitz: one shared 120 s countdown, rank 1 ends it early, best rank wins.
- [x] Zeitbonus-Jagd: per-player clock, 60 s start, +8 s per improving guess, capped.
- [x] `backend/test_arena.py`.

### Phase 4: matchmaking queue
- [x] `matchmaking_queue` table plus `backend/matchmaking.py`.
- [x] `POST /api/matchmaking/enqueue`, `GET /api/matchmaking/status`,
      `POST /api/matchmaking/cancel`.
- [x] Pairing job in the WS worker only, one writer, `WHERE matched_room_id IS NULL`.
- [x] Serves duel, koop, wordle-duel, royale, blitz and timerush.
- [x] Nicknames facing strangers: server-generated German default, free text only after a
      profanity check reusing `target_selection.PROFANITY_BLOCKLIST`.
- [x] Stale tickets pruned in `_cleanup_loop`.
- [x] `backend/test_matchmaking.py`.

### Phase 5: arena and matchmaking frontend
- [x] `lib/arena-api.ts`, `lib/arena-types.ts`, `lib/use-arena-websocket.ts`,
      `lib/matchmaking-api.ts`.
- [x] Routes `/arena/` (room id read from the path), `/arena/create/` and `/suche/`. One
      route for all three arenas, because the mode comes from the room state and does not
      need to be in the URL; that is one nginx fallback instead of three.
- [x] Countdown rendering derives from the server deadline, never from a local clock start.

### Phase 6: menu, discovery page, SEO
- [x] Header keeps the established entries and gains one: "Weitere Mehrspielermodi".
- [x] `/modi/` built from `components/seo/SeoPrimitives.tsx`, crawlable without JS, Motion
      only as progressive enhancement.
- [x] Registered in `app/sitemap.ts`, `lib/content-revisions.ts`, `buildMetadata`, JSON-LD.

### Phase 7: game pool to 10000
- [x] `scripts/extend-game-pool.py`, modelled on `regenerate-future-games.py`.
- [x] Fidelity gate: reproduce prod's `vocabulary.json` exactly and a sample of prod's npz
      bit-for-bit before writing anything.
- [x] Append only targets with zero overlap against prod's `target_words.json`.
- [x] Assert the daily schedule has not wrapped yet, so growing `total_games` cannot shift
      which word is today's.
- [x] Runbook for the SSH upload in `docs/plans/2026-09-20-mode-expansion-upload.md`. The
      upload itself is not run here.
- [x] Measured cost: one npz is about 215 KiB, so 10,000 games is about 2.05 GiB in the
      `kontexto-data` volume, roughly 1.6 GiB more than today. The image is unaffected.

### Phase 8: full verification
- [x] `pnpm build`, `pnpm test`, `pnpm seo:check`, `pnpm verify:slop --all`,
      `pnpm verify:dashes`, `pnpm test:e2e`, `pytest`.

## Decisions

- **One arena module instead of three more duel clones.** Royale, Blitz and Zeitbonus-Jagd
  differ only in how a deadline is set and what happens when it passes. A fourth copy of the
  duel table triple would have to be kept in sync forever.
- **Deadlines as absolute server timestamps.** A duration plus a client start time is
  unverifiable and drifts. `deadline_at` is written once by the server and read by everyone.
- **The queue is a table, not memory.** Five workers share nothing but SQLite, so an
  in-memory queue would pair players only when they happened to hit the same worker.
- **Solo rules stay on the client where they carry no stakes.** Leiter and Limitierte
  Versuche add no server state. Doppelziel and Sudden Death need new endpoints because the
  client must not learn the target.

## Result

All gates green on 2026-09-20:

| Gate | Result |
|-|-|
| `pnpm build` | static export, 34 routes |
| `pnpm test` | 156 passed |
| `pnpm seo:check` | passed |
| `pnpm verify:slop --all` | 0 findings, 239 files |
| `pnpm verify:dashes` | 0 findings, 365 files |
| `pnpm test:e2e` | 19 passed |
| `pytest` | 512 passed |

## Found along the way

- **`matchmaking.py` pulled HanTa and wordfreq into the request path** by importing
  `target_selection` for one frozenset. The list now lives in `backend/wordlists.py`, and
  the runtime boots on the runtime dependencies alone, which `backend/.venv-win` proves.
- **Leiter asked for rank 5000 unconditionally.** Correct against the production
  vocabulary of 80,000 words, fatal against any smaller one: the round never started and
  the player saw a skeleton. The opening rank is now clamped to the vocabulary.
- **`pnpm test:e2e` could not run on Windows.** `playwright.config.ts` found the WSL
  venv's `bin/uvicorn` as a file and then failed to execute it, with an error that named
  nothing useful. It now prefers `backend/.venv-win` and passes an absolute, quoted path.
- **The pool cannot simply be 10,000.** One npz is 215 KiB, so the target size is about
  2.05 GiB in the `kontexto-data` volume, roughly 1.6 GiB more than today, and the
  vocabulary may not hold 10,000 solutions above the standard Zipf 4.0 bar. The script
  reports both rather than deciding either quietly.

## The pool run, 2026-09-20

Run for real against production, from a read-only copy pulled over SSH.

- Production before: 2,400 games, start date 2026-06-08, vocabulary 80,000, 524 MB.
- All three gates passed: the vocabulary reproduced from the `.vec` file matched prod
  byte-exactly, 24 existing npz reproduced bit for bit, and the wrap gate found day 105 of
  2,400, so raising `total_games` cannot move a daily word.
- **Every one of the 2,400 existing solutions sits at Zipf 4.0 or above, and that band is
  spent**: only 69 unused words are left in it. Any growth therefore has to come from a
  rarer band, which is a product decision, not a technical one. Chosen floor: Zipf 3.2.
- Result: 7,141 games appended, pool 2,400 to 9,541. Games 1 to 2,400 are untouched and
  `target_words.json` keeps the old list as its exact prefix.
- Hand audit of the appended words against the name gazetteer and the 120 most common
  German surnames found four with no everyday common-noun sense: `hübner`, `riedel`,
  `orion`, `jeep`. They went into `NAME_BLOCKLIST` and the pool was regenerated. The many
  surnames that *are* ordinary nouns (`bergmann`, `hahn`, `fuhrmann`, `koch`) stayed, which
  is the filter working as designed.
- User-facing text that quoted the old pool size was updated (`lib/faqs.ts`,
  `components/seo/HomeContent.tsx`). The benchmark sentences that say "measured over all
  2,400 puzzles" were left alone: that measurement was over 2,400 and still was.

## Not done here

Nothing is pushed. Every commit is local, per the standing rule that a push is a deploy
and a deploy is the user's call.
