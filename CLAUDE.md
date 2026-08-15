# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Kontexto — a German semantic word‑guessing game (guess the secret word; each guess is ranked by semantic closeness), plus a **Wördle** mode and real‑time **duel** modes for both, and a passkey‑protected admin analytics dashboard. Monorepo:

- `frontend/` — Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui. Ships as a **static export**.
- `backend/` — FastAPI + Uvicorn, SQLite, NumPy/fastText. Serves the game API, duel WebSockets, and analytics.
- `data/` — pre‑computed game data (word rankings, vocab, Bloom filter, Wordle word lists) + the runtime SQLite DB. Generated, not in git.
- Root — Docker multi‑stage build, `docker-compose.yml` (Caddy + app), `nginx.conf`, `supervisord.conf`, `Caddyfile`, `.github/workflows/deploy.yml`.

## Commands

### Frontend (`cd frontend`) — uses **pnpm** (Node ≥ 24), never npm
```bash
pnpm install
pnpm dev                 # next dev (expects backend at NEXT_PUBLIC_API_URL, default in .env.development)
pnpm build               # next build → static export to frontend/out (THE primary verification gate: runs TS type-check + export)
pnpm test                # vitest run
pnpm test -- <file>      # single test file, e.g. pnpm test -- lib/blog.test.ts
pnpm test:watch          # vitest watch
pnpm seo:check           # node scripts/seo-check.mjs — asserts canonical/hreflang/H1/word-count/JSON-LD/sitemap on content pages
```
**Do not use `pnpm lint`** — ESLint 10 is incompatible with eslint-plugin-react 7.x and it crashes project‑wide (`contextOrFilename.getFilename is not a function`) on the first file, regardless of your changes. Use **`pnpm build` + `pnpm test` + `pnpm seo:check`** as the real gates until the versions are reconciled.

### Backend (`cd backend`) — Python 3.12, pytest
```bash
python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
KONTEXTO_DEV=1 KONTEXTO_DATA_DIR=../data uvicorn main:app --reload   # dev API server (single process, no background tasks)
pytest                                                              # all backend tests (run from backend/)
pytest test_analytics.py::test_name                                # single test
bash ../scripts/prepare-data.sh ../data/                            # build game data (downloads German fastText, computes rankings) — needed once for local dev
```

### Full stack
```bash
docker compose up --build    # http://localhost:8080 — builds frontend, prepares data, runs nginx+supervisor+uvicorn
```

## Architecture (the parts that span multiple files)

### Backend process model
`main.py` is one FastAPI app run as **two roles** (see `supervisord.conf`): **4 API workers** (`:8000`) and **exactly one WebSocket worker** (`:8001`, started with `KONTEXTO_WS_MODE=1`). All background loops — analytics aggregation/pruning (every 5 min), duel cleanup, and duel WebSocket poll‑and‑broadcast (every 1 s) — run **only in the WS worker** (single writer, no races). There is no in‑process shared state between workers: **SQLite is the single source of truth**, so all writes must be idempotent (HLL `MAX`‑upserts, daily upserts) because multiple workers write concurrently (WAL, 5 s busy timeout).

### Game engine (the core mechanic is pre‑computed)
There is **no live embedding inference at request time**. `prepare.py` (offline / build step) loads the German fastText model, debiases vectors (remove mean + top‑3 PCs), computes cosine similarity to each target, and writes per‑game rank arrays to `data/games/{NNNN}.npz`, plus `vocabulary.json`, `lemma_map.json`, `bloom.bin`, `target_words.json`, `metadata.json`. At runtime `game.py` does an O(1) dict/array lookup `word → rank`. Wordle uses `data/wordle/{solutions,valid_words}.json`.

### API surface (all under `/api`, defined in `main.py`, logic in `game.py`/`duel.py`/`wordle.py`/`wordle_duel.py`)
- Kontexto: `guess`, `tip`, `game`, `games`, `reveal`, `closest`.
- Duel: `duel` (create), `duel/{id}/join|guess|history|tip`, `duel/player-info`, `GET duel/{id}` (state); realtime `WS /ws/duel/{id}?token=…`.
- Wordle + Wordle duel: mirror of the above under `/api/wordle/…` and `WS /ws/wordle/duel/{id}`.
- Analytics: `collect/token`, `collect` (pageview), `stats/complete` (client completion histograms).
- Admin: `admin/webauthn/{login,register}/{options,verify}`, `GET admin/stats`.

Duel realtime is **DB‑polling broadcast** (`websocket_manager.py`): the WS worker polls the players table every second and pushes diffs (`player_joined`/`rank_update`/`player_solved`/connect‑state) to all sockets in that duel.

### Analytics (cookieless, server‑authoritative — `analytics.py`)
Authoritative counts (guesses/solves/hints/reveals/duels) are incremented **server‑side from the real handlers**, never trusted from the client. Visitor identity is an anonymous, non‑reversible fingerprint `SHA256(IP + UA + monthly salt)` folded into **HyperLogLog** sketches (all‑time + monthly) for unique‑visitor estimates. Raw `analytics_events` are kept **35 days** then pruned; permanent rollups live in `analytics_daily`/`analytics_counters`/HLL tables. Only the completion **distribution histograms** come from the client (`stats/complete`), token‑gated + bot‑filtered + deduped. Heatmap/peak‑hour stats are bucketed in **`DISPLAY_TZ = Europe/Berlin`** (`analytics.py`).

### Admin auth (`auth.py`)
A single **WebAuthn passkey** protects `/admin`. Login issues an HMAC‑signed session token (12 h TTL, `Authorization: Bearer …`). Registration is **break‑glass**: disabled unless `KONTEXTO_ADMIN_ENROLL_TOKEN` is set. Brute‑force protection is per‑IP (in‑memory) + global (DB). All HMACs (fingerprint salt, beacon tokens, session/WebAuthn tokens) derive from one secret in `server_secret.py` (fail‑closed in prod).

### Frontend
Static export (`next.config.ts`: `output:"export"`, `trailingSlash:true`). Dynamic duel URLs (`/duel/<id>/`) render the single `/duel` page and read the id from `window.location.pathname`; in prod nginx does the `try_files … /duel/index.html` fallback, in dev `next.config.ts` adds `rewrites()` for the same effect. Client state is plain `useState`/`useEffect` + `localStorage` (no SWR/React Query); keys are prefixed `kontexto_*` / `wordle_*`. Theme is read by an inline script in `app/layout.tsx` before hydration to avoid a flash. API access goes through `lib/api.ts` / `lib/duel-api.ts` / `lib/wordle-api.ts` (base = `NEXT_PUBLIC_API_URL`, fallback `/api`; errors thrown as coded strings like `"unauthorized"`), and the two WS hooks `lib/use-duel-websocket.ts` / `lib/use-wordle-duel-ws.ts`. recharts is loaded via `next/dynamic({ ssr:false })` (`app/admin/stats/page.tsx`) so it stays out of the main bundle — keep dashboard/skeleton code free of static recharts imports. UI text is German throughout; de‑DE formatting helpers live in `lib/format.ts`.

### SEO layer (a deliberate hybrid — don't regress it)
Content/SEO pages use **JS‑free primitives** (`components/seo/SeoPrimitives.tsx`, `SeoFaq.tsx` built on `<details>`) so all content is crawlable in the static HTML. **Framer Motion** (`motion` package via `components/motion/MotionProvider.tsx`, `LazyMotion` strict + `MotionConfig reducedMotion="user"`) is layered **only as progressive enhancement** — never as the source of content. Per‑page metadata + self‑canonicals + hreflang come from `lib/seo.ts` (`buildMetadata`); JSON‑LD from `lib/structured-data.ts`; `app/sitemap.ts` + `app/robots.ts` are dynamic; the blog is MDX with an **explicit static loader map** in `app/blog/[slug]/page.tsx` (no template‑literal dynamic imports — they break under static export).

### Deployment
Push to **`master`** is the deploy: `.github/workflows/deploy.yml` runs `pytest`, then SSHes to `/opt/kontexto` and runs `docker compose up --build`. The Dockerfile is multi‑stage (build frontend → prepare data → runtime image with nginx + supervisor + uvicorn). Caddy terminates HTTPS in front. Health checks hit `/api/game` and `/api/collect/token`.

## Rules & gotchas

- **pnpm only** for the frontend (Node ≥ 24). The frontend is built **without a running backend** (Dockerfile stage 1), so **never add build‑time fetches to the backend** — daily‑solution/archive pages and AggregateRating stars were removed for exactly this reason. If you need backend data at build time, generate it from `data/` files instead, or build against a running backend.
- **Lockfile discipline:** the `@types/react` version must match across `frontend/package.json`, the `pnpm-workspace.yaml` overrides, and `pnpm-lock.yaml`, or clean Docker CI fails with `ERR_PNPM_OUTDATED_LOCKFILE` (a local frozen install can mask it). Verify a change with `rm -rf node_modules && pnpm install --frozen-lockfile`.
- **`KONTEXTO_SERVER_SECRET` must stay stable forever** — changing it resets unique‑visitor counts and invalidates all admin sessions. Prod refuses to start without it; for local dev set `KONTEXTO_DEV=1` instead.
- **Background tasks live in the WS worker only** (`KONTEXTO_WS_MODE=1`). Don't assume aggregation/cleanup runs in API workers. Keep all DB writes idempotent — multiple workers write the same SQLite file.
- **Analytics:** never make authoritative metrics client‑trusted; only distributions come from the client, and always token‑gated + bot‑filtered + deduped.
- **Content conventions:** German UI, **no emojis** in content, and aim for production‑ready, best‑practice work on the first pass (no MVP/iterative shortcuts — see the global guidance in `~/.claude/CLAUDE.md`). `frontend/lib/legal.ts` holds the real Impressum data (a booked c/o address service, second contact path per § 5 DDG, responsible person per § 18 MStV); the private home address is deliberately not published. Typography is enforced: no em dash (U+2014), German quotes `„…“` only, and en dash only in numeric ranges. `pnpm seo:check` fails the build on violations, on unbalanced quotes, and on any blog post under 900 rendered words.
- **Standing SEO goal:** kontexto.de should out‑rank the competitor kontexto.app. Preserve the crawlable static content, self‑referencing canonicals, hreflang, JSON‑LD, and full sitemap — these were hard‑won; don't regress them.

## Env vars

- Backend: `KONTEXTO_SERVER_SECRET` (required in prod), `KONTEXTO_DATA_DIR` (default `data`), `KONTEXTO_DEV`, `KONTEXTO_FORCE_GAME`, `KONTEXTO_WEBAUTHN_RP_ID` / `KONTEXTO_WEBAUTHN_ORIGIN`, `KONTEXTO_ADMIN_ENROLL_TOKEN`, `KONTEXTO_TRUSTED_PROXY_HOPS`, `KONTEXTO_WS_MODE`. See `.env.example`.
- Frontend (inlined at build time): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AD_SLOT_*` (AdSense slots; unset slots render nothing). See `frontend/.env.development` and `frontend/lib/adsense.ts`.
