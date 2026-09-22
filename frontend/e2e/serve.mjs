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
const SECTION_FALLBACKS = [
  "/wordle/duel/",
  "/wordle/",
  "/arena/",
  "/duel/",
  "/koop/",
  "/live/overlay/",
  "/live/",
];

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

async function hasCanonicalDirectory(pathname) {
  if (pathname === "/" || pathname.endsWith("/")) return false;
  const decoded = decodeURIComponent(pathname);
  const safe = path.posix.normalize(decoded).replace(/^(\.\.\/)+/, "/");
  const indexFile = path.join(ROOT, safe, "index.html");
  return indexFile.startsWith(ROOT) && (await isFile(indexFile));
}

function robotsHeader(pathname) {
  if (
    /^\/(?:arena|duel|koop|live)\/[^/?]+(?:\/|$)/.test(pathname) ||
    /^\/wordle\/duel\/[^/?]+(?:\/|$)/.test(pathname) ||
    pathname.startsWith("/admin/") ||
    /\/[^?]*index\.txt$/.test(pathname) ||
    /\/[^?]*__next[^?]*\.txt$/.test(pathname)
  ) {
    return "noindex, nofollow";
  }
  return undefined;
}

const server = http.createServer(async (req, res) => {
  const pathname = (req.url || "/").split("?")[0];

  if (pathname.startsWith("/api/")) {
    proxy(req, res);
    return;
  }

  // nginx canonicalizes the physical index.html filenames emitted by the
  // static export. Keep the E2E proxy's URL graph identical to production so
  // these duplicate URLs cannot silently reappear in local checks.
  if (pathname === "/index.html") {
    res.writeHead(301, { location: "/" });
    res.end();
    return;
  }

  // The 404 document is an internal nginx error target, never a public 200
  // page. Mirror that distinction in the test proxy.
  if (pathname === "/404.html") {
    const notFound = path.join(ROOT, "404.html");
    if (await isFile(notFound)) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      createReadStream(notFound).pipe(res);
    } else {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
    }
    return;
  }

  // Next's internal error-route directories are physical export artifacts,
  // never public documents. Mirror nginx's internal location for them.
  if (/^\/(?:_not-found|404)(?:\/|$)/.test(pathname)) {
    const notFound = path.join(ROOT, "404.html");
    if (await isFile(notFound)) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      createReadStream(notFound).pipe(res);
    } else {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
    }
    return;
  }

  // nginx redirects a real exported route without its trailing slash before
  // serving the directory index. Mirror that behavior so the E2E URL graph
  // catches duplicate canonical candidates that could otherwise appear in
  // Search Console as URLs without a referring sitemap. Internal 404
  // directories are handled above and must remain real 404 responses.
  if (await hasCanonicalDirectory(pathname)) {
    res.writeHead(301, { location: `${pathname}/` });
    res.end();
    return;
  }

  // The error-route check above must precede this generic nested index
  // redirect: `/404/index.html` is an internal export artifact, not a
  // canonical public page that may redirect to `/404/`.
  const nestedIndex = pathname.match(/^\/(.+)\/index\.html$/);
  if (nestedIndex) {
    res.writeHead(301, { location: `/${nestedIndex[1]}/` });
    res.end();
    return;
  }

  const file = await resolveFile(pathname);
  if (file) {
    const xRobots = robotsHeader(pathname);
    res.writeHead(200, {
      "content-type": contentType(file),
      "cache-control": "no-cache",
      ...(xRobots ? { "x-robots-tag": xRobots } : {}),
    });
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
