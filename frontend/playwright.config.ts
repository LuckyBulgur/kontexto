import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Prerequisites for `pnpm test:e2e` (CI runs these explicitly, see deploy.yml):
//   1. Mock dataset:   python scripts/create-test-data.py --output data-e2e
//   2. Static export:  NEXT_PUBLIC_API_URL=/api pnpm build   (from frontend/)
// The webServer block then boots the backend + the nginx-mirroring proxy.

// Dedicated test ports: deliberately NOT 8000/8001, so the suite never collides
// with — or silently reuses — a developer's running dev backend (which reads the
// real data dir and lacks the broadcast loops). The proxy is told the backend
// port via E2E_BACKEND_PORT.
const BACKEND_PORT = 8123;
const PROXY_PORT = 4173;

// Use the backend virtualenv locally; fall back to `python -m uvicorn` in CI,
// where requirements are installed into the job's Python on PATH.
const backendCommand = existsSync("../backend/.venv/bin/uvicorn")
  ? `.venv/bin/uvicorn main:app --host 127.0.0.1 --port ${BACKEND_PORT} --log-level warning`
  : `python -m uvicorn main:app --host 127.0.0.1 --port ${BACKEND_PORT} --log-level warning`;

export default defineConfig({
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
      env: { KONTEXTO_DEV: "1", KONTEXTO_DATA_DIR: "../data-e2e" },
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
