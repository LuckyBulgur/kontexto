// Zero-dependency reverse proxy for E2E tests. Mirrors nginx.conf so the static
// export is exercised over a single origin exactly as in production:
//   - static files served from out/ (this is what the real export ships),
//   - dynamic-id sections fall back to their single page (try_files …
//     /<section>/index.html), matching nginx's longest-prefix blocks,
//   - /api/* and /ws/* (WebSocket upgrade) are proxied to the backend.
// The same-origin model is required: the duel WS URL is hard-wired to
// `${location.host}/ws` (lib/use-duel-websocket.ts), so cross-origin setups
// never reach it.
import http from "node:http";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.E2E_OUT_DIR || path.join(HERE, "..", "out"));
const PORT = Number(process.env.E2E_PORT || 4173);
const BACKEND_HOST = process.env.E2E_BACKEND_HOST || "127.0.0.1";
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 8000);

// Longest-prefix first, mirroring nginx (/wordle/duel/ before /wordle/).
const SECTION_FALLBACKS = ["/wordle/duel/", "/wordle/", "/duel/", "/koop/"];

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext) return CONTENT_TYPES[ext] || "application/octet-stream";
  // Next's opengraph-image / twitter-image routes emit extensionless PNGs.
  if (/image$/.test(path.basename(filePath))) return "image/png";
  return "application/octet-stream";
}

async function isFile(p) {
  try {
    return (await fs.stat(p)).isFile();
  } catch {
    return false;
  }
}

function proxy(req, res) {
  const proxyReq = http.request(
    {
      host: BACKEND_HOST,
      port: BACKEND_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
    res.end("backend unavailable");
  });
  req.pipe(proxyReq);
}

async function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname);
  // Prevent path traversal; keep the leading slash semantics.
  const safe = path.posix.normalize(decoded).replace(/^(\.\.\/)+/, "/");
  const abs = path.join(ROOT, safe);

  // try_files $uri $uri/ …
  const candidates = [abs, path.join(abs, "index.html")];
  if (pathname === "/") candidates.unshift(path.join(ROOT, "index.html"));
  for (const section of SECTION_FALLBACKS) {
    if (pathname.startsWith(section)) {
      candidates.push(path.join(ROOT, section, "index.html"));
      break;
    }
  }
  for (const candidate of candidates) {
    if (candidate.startsWith(ROOT) && (await isFile(candidate))) return candidate;
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const pathname = (req.url || "/").split("?")[0];

  if (pathname.startsWith("/api/")) {
    proxy(req, res);
    return;
  }

  const file = await resolveFile(pathname);
  if (file) {
    res.writeHead(200, { "content-type": contentType(file), "cache-control": "no-cache" });
    createReadStream(file).pipe(res);
    return;
  }

  const notFound = path.join(ROOT, "404.html");
  if (await isFile(notFound)) {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    createReadStream(notFound).pipe(res);
  } else {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
});

// WebSocket upgrade proxy (/ws/*): raw socket tunnelling to the backend.
server.on("upgrade", (req, clientSocket, head) => {
  if (!req.url || !req.url.startsWith("/ws/")) {
    clientSocket.destroy();
    return;
  }
  const proxyReq = http.request({
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  });
  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    const lines = [`HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}`];
    for (const [key, value] of Object.entries(proxyRes.headers)) lines.push(`${key}: ${value}`);
    clientSocket.write(lines.join("\r\n") + "\r\n\r\n");
    if (proxyHead && proxyHead.length) clientSocket.write(proxyHead);
    proxySocket.pipe(clientSocket);
    clientSocket.pipe(proxySocket);
    const teardown = () => {
      proxySocket.destroy();
      clientSocket.destroy();
    };
    proxySocket.on("error", teardown);
    clientSocket.on("error", teardown);
  });
  proxyReq.on("error", () => clientSocket.destroy());
  if (head && head.length) proxyReq.write(head);
  proxyReq.end();
});

if (!(await isFile(path.join(ROOT, "index.html")))) {
  console.error(
    `E2E proxy: no static export at ${ROOT}\n` +
      "Build it first:  NEXT_PUBLIC_API_URL=/api pnpm build",
  );
  process.exit(1);
}

server.listen(PORT, () => {
  console.log(`E2E proxy: http://localhost:${PORT} -> static ${ROOT} + api/ws -> ${BACKEND_HOST}:${BACKEND_PORT}`);
});
