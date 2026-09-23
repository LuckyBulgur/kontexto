import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Prerequisites for `pnpm test:e2e` (CI runs these explicitly, see deploy.yml):
//   1. Mock dataset:   python scripts/create-test-data.py --output data-e2e
//   2. Static export:  NEXT_PUBLIC_API_URL=/api pnpm build   (from frontend/)
// The webServer block then boots the backend + the nginx-mirroring proxy.

// Dedicated test ports: deliberately NOT 8000/8001, so the suite never collides
// with, or silently reuses, a developer's running dev backend (which reads the
// real data dir and lacks the broadcast loops). The proxy is told the backend
// port via E2E_BACKEND_PORT.
const BACKEND_PORT = 8123;
const PROXY_PORT = 4173;

// Use a backend virtualenv when there is one; fall back to `python -m uvicorn`
// in CI, where requirements are installed into the job's Python on PATH.
//
// Windows gets its own candidate. A venv created under WSL lives at
// backend/.venv and its `bin/uvicorn` exists as a file on the Windows side too,
// so the plain existsSync check passed and then failed to execute a Linux
// script, with an error that says nothing about why. backend/.venv-win is the
// Windows venv and is gitignored like the others.
const BACKEND_VENV_CANDIDATES = [
  "../backend/.venv-win/Scripts/uvicorn.exe",
  "../backend/.venv/Scripts/uvicorn.exe",
  "../backend/.venv/bin/uvicorn",
];
const backendVenv = BACKEND_VENV_CANDIDATES.find((candidate) => existsSync(candidate));
const backendArgs = `main:app --host 127.0.0.1 --port ${BACKEND_PORT} --log-level warning`;
// Absolute and quoted: cmd.exe does not resolve a bare relative path like
// `.venv-win/Scripts/uvicorn.exe` and reports it as a misspelled command.
const backendCommand = backendVenv
  ? `"${resolve(backendVenv)}" ${backendArgs}`
  : `python -m uvicorn ${backendArgs}`;

export default defineConfig({
  // Clears the matchmaking queue before the run; see e2e/global-setup.ts for
  // why that one table and not the whole database.
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  // Single backend + one SQLite file is shared state; run serially so the smoke
  // suite stays deterministic and easy to debug.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PROXY_PORT}`,
    trace: "on-first-retry",
    video: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // One process serves /api + /ws AND runs the broadcast loops: the lifespan
      // starts them when KONTEXTO_DEV is set (backend/main.py). No separate WS
      // worker needed for tests.
      command: backendCommand,
      cwd: "../backend",
      // The smoke suite runs on the mock dataset. KONTEXTO_E2E_DATA_DIR points
      // the same stack at another one, which is how the README screenshots are
      // taken: they need a real dataset, because a mock has no semantics and a
      // picture of it would show nonsense ranks. See e2e/readme-shots.spec.ts.
      env: {
        KONTEXTO_DEV: "1",
        KONTEXTO_DATA_DIR: process.env.KONTEXTO_E2E_DATA_DIR ?? "../data-e2e",
        // Live chat mode must not dial Twitch or TikTok from a test run. The
        // ingest still reconciles rooms and accepts messages, they just come
        // from the dev-only debug endpoint instead of a socket. See
        // backend/live_ingest.py.
        KONTEXTO_LIVE_OFFLINE: "1",
        // A dummy key offers TikTok in the form. OFFLINE means it is never sent.
        KONTEXTO_EULER_API_KEY: "e2e-offline",
        // Caps every matchmaking grace period (12 to 25 s in production) at
        // 1 s, so a queue test waits one pairing pass instead of the real
        // grace. Honoured only with KONTEXTO_DEV; see backend/matchmaking.py.
        KONTEXTO_MATCHMAKING_GRACE_CAP: "1",
      },
      url: `http://127.0.0.1:${BACKEND_PORT}/api/game`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // Reverse proxy that mirrors nginx.conf: serves the static export and
      // proxies /api + /ws to the backend on a single origin (required by the
      // same-origin duel WS URL).
      command: "node e2e/serve.mjs",
      env: { E2E_PORT: String(PROXY_PORT), E2E_BACKEND_PORT: String(BACKEND_PORT) },
      url: `http://127.0.0.1:${PROXY_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
