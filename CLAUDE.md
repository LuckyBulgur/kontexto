# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Kontexto: a German semantic word‑guessing game (guess the secret word; each guess is ranked by semantic closeness), plus a **Wördle** mode, several solo rule sets, real‑time **duel**, **koop** and three timed **arena** modes, a random matchmaking queue in front of all of them, and a passkey‑protected admin analytics dashboard. Monorepo:

- `frontend/`: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui. Ships as a **static export**.
- `backend/`: FastAPI + Uvicorn, SQLite, NumPy/fastText. Serves the game API, duel WebSockets, and analytics.
- `data/`: pre‑computed game data (word rankings, vocab, Bloom filter, Wordle word lists) + the runtime SQLite DB. Generated, not in git.
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
```

### Full stack
```bash
docker compose up --build    # http://localhost:8080, builds frontend, prepares data, runs nginx+supervisor+uvicorn
```

## Architecture (the parts that span multiple files)

### Backend process model
`main.py` is one FastAPI app run as **two roles** (see `supervisord.conf`): **4 API workers** (`:8000`) and **exactly one WebSocket worker** (`:8001`, started with `KONTEXTO_WS_MODE=1`). Five background loops run **only in the WS worker** (single writer, no races): analytics aggregation/pruning plus room cleanup and queue pruning (every 5 min), the duel/koop/wordle‑duel poll‑and‑broadcast loops, the **arena clock** (`arena.advance_due_arenas`, every 1 s, applies every deadline that has passed) and the **matchmaking loop** (`matchmaking.run_matchmaking`, every 1 s, forms parties). There is no in‑process shared state between workers: **SQLite is the single source of truth**, so all writes must be idempotent (HLL `MAX`‑upserts, daily upserts) because multiple workers write concurrently (WAL, 5 s busy timeout).

### Game engine (the core mechanic is pre‑computed)
There is **no live embedding inference at request time**. `prepare.py` (offline / build step) loads the German fastText model, debiases vectors (remove mean + top‑3 PCs), computes cosine similarity to each target, and writes per‑game rank arrays to `data/games/{NNNN}.npz`, plus `vocabulary.json`, `lemma_map.json`, `bloom.bin`, `target_words.json`, `metadata.json`. At runtime `game.py` does an O(1) dict/array lookup `word → rank`. Wordle uses `data/wordle/{solutions,valid_words}.json`.

### API surface (all under `/api`, defined in `main.py`, logic in `game.py`/`duel.py`/`koop.py`/`arena.py`/`matchmaking.py`/`wordle.py`/`wordle_duel.py`)
- Kontexto: `guess`, `tip`, `game`, `games`, `reveal`, `closest`. `guess`/`tip`/`reveal` take an optional `mode` (validated against `analytics.SOLO_MODES`) so the solo modes are counted apart.
- Solo modes: `word-at-rank` (Leiter's opening word, never rank 1), `dual/next` + `dual/guess` (Doppelziel, both ranks in one request), `sudden-death` (a game plus its runners‑up).
- Duel: `duel` (create), `duel/{id}/join|guess|history|tip`, `duel/player-info`, `GET duel/{id}` (state); realtime `WS /ws/duel/{id}?token=…`.
- Arena (Battle Royale, Blitz‑Duell, Zeitbonus‑Jagd): `arena` (create), `arena/{id}/join|start|guess|history|next-game`, `arena/player-info`, `GET arena/{id}`; realtime `WS /ws/arena/{id}?token=…`.
- Matchmaking: `matchmaking/enqueue|status|cancel`. One queue for duel, koop, wordle‑duel and the three arenas.
- Wordle + Wordle duel: mirror of the above under `/api/wordle/…` and `WS /ws/wordle/duel/{id}`.
- Analytics: `collect/token`, `collect` (pageview, optional `share` marker), `collect/heartbeat` (presence + attention when the tab is visible), `collect/share` (share button pressed), `stats/complete` (client completion histograms), `survey/answer` (attribution survey, one answer per fingerprint).
- Admin: `admin/webauthn/{login,register}/{options,verify}`, `GET admin/stats`.

Duel realtime is **DB‑polling broadcast** (`websocket_manager.py`): the WS worker polls the players table every second and pushes diffs (`player_joined`/`rank_update`/`player_solved`/connect‑state) to all sockets in that duel.

### Arenas and the clock (`arena.py`)
Battle Royale, Blitz‑Duell and Zeitbonus‑Jagd share one table triple (`arenas`/`arena_players`/`arena_guesses`); they differ only in how a deadline is set and what happens when it passes. **The server owns time.** Every deadline is an absolute UTC timestamp written in `arena.iso_timestamp` (fixed width, so SQLite's string comparison is a time comparison) and shipped to the client together with `server_time`, which the client uses to correct its own clock. The guess path refuses a late guess itself (409 `time_up`), so the buzzer cannot be beaten inside the evaluator's one‑second window. Every transition in `advance_due_arenas` is guarded by the state it expects (`WHERE status = 'running' AND deadline_at <= ?`), so a repeated pass is a no‑op.

### Matchmaking (`matchmaking.py`)
One `matchmaking_queue` table in front of every multiplayer mode. A table and not process memory, because the five workers share nothing else. Pairing runs in the WS worker and claims tickets under `matched_room_id IS NULL`. Playing with strangers changes what a nickname is: the queue defaults to a generated German name and accepts a typed one only after a substring profanity check (`wordlists.PROFANITY_BLOCKLIST`, transliterated). Invite‑link rooms keep their free text.

### Analytics (cookieless, server‑authoritative, `analytics.py`)
Authoritative counts (guesses/solves/hints/reveals/duels) are incremented **server‑side from the real handlers**, never trusted from the client. Visitor identity is an anonymous, non‑reversible fingerprint `SHA256(IP + UA + monthly salt)` folded into **HyperLogLog** sketches (all‑time + monthly) for unique‑visitor estimates. Raw `analytics_events` are kept **35 days** then pruned; permanent rollups live in `analytics_daily`/`analytics_counters`/HLL tables. Only the completion **distribution histograms** come from the client (`stats/complete`), token‑gated + bot‑filtered + deduped. The attribution survey („Woher kennst du Kontexto?", `survey/answer`) follows the same pattern: the countable answer is a permanent counter (`survey_source_v1`), the dedup ledger `analytics_survey_seen` is kept 180 days, and the optional free text lives in `analytics_survey_details` **without** a fingerprint. Frontend side: `lib/survey.ts` (catalogue, shuffle, frequency caps), `components/SourceSurvey*.tsx`. Three further growth signals share the same posture: `starts` (counted once per fingerprint, mode and game via `analytics_start_seen`, triggered by the `first` flag on the opening guess, which is only a hint because the ledger caps it), `shares` plus `share_arrivals` (the share text carries `?s=<game>`, the marker is counted per page and stripped from the address bar on arrival) and `attention` (one heartbeat of a visible tab = `HEARTBEAT_SECONDS`). Heatmap/peak‑hour stats are bucketed in **`DISPLAY_TZ = Europe/Berlin`** (`analytics.py`).

### Admin auth (`auth.py`)
A single **WebAuthn passkey** protects `/admin`. Login issues an HMAC‑signed session token (12 h TTL, `Authorization: Bearer …`). Registration is **break‑glass**: disabled unless `KONTEXTO_ADMIN_ENROLL_TOKEN` is set. Brute‑force protection is per‑IP (in‑memory) + global (DB). All HMACs (fingerprint salt, beacon tokens, session/WebAuthn tokens) derive from one secret in `server_secret.py` (fail‑closed in prod).

### Frontend
Static export (`next.config.ts`: `output:"export"`, `trailingSlash:true`). Dynamic room URLs (`/duel/<id>/`, `/koop/<id>/`, `/wordle/duel/<id>/`, `/arena/<id>/`) render the single matching page and read the id from `window.location.pathname`; in prod nginx does the `try_files … /duel/index.html` fallback, in dev `next.config.ts` adds `rewrites()` and `e2e/serve.mjs` mirrors both. One `/arena/` route serves all three arena modes, because the mode comes from the room state and does not need to be in the URL. Solo modes live at `/solo/{leiter,limit,doppelziel,sudden-death}/`, the queue at `/suche/`, the catalogue at `/modi/`; `lib/solo-modes.ts` and `lib/multiplayer-modes.ts` are the single source for a mode's name, pitch and rules. Client state is plain `useState`/`useEffect` + `localStorage` (no SWR/React Query); keys are prefixed `kontexto_*` / `wordle_*`. Theme is read by an inline script in `app/layout.tsx` before hydration to avoid a flash. API access goes through `lib/api.ts` / `lib/duel-api.ts` / `lib/wordle-api.ts` (base = `NEXT_PUBLIC_API_URL`, fallback `/api`; errors thrown as coded strings like `"unauthorized"`), and the two WS hooks `lib/use-duel-websocket.ts` / `lib/use-wordle-duel-ws.ts`. recharts is loaded via `next/dynamic({ ssr:false })` (`app/admin/stats/page.tsx`) so it stays out of the main bundle. Keep dashboard/skeleton code free of static recharts imports. UI text is German throughout; de‑DE formatting helpers live in `lib/format.ts`.

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
