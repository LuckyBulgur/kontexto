/**
 * Where the realtime sockets live.
 *
 * In production the page and the API share one origin: nginx serves the static
 * export and proxies `/api` and `/ws` to the backend, so a socket URL built
 * from `window.location` is right. In `pnpm dev` it is not. The page is on
 * :3000 and the backend on :8000, `NEXT_PUBLIC_API_URL` points the REST calls
 * at the second one, and the socket URL kept pointing at the first, where
 * nothing listens. The socket then failed and retried every two seconds,
 * silently, for as long as the page was open.
 *
 * Nobody noticed for the older modes: a player sees their own guess from the
 * REST response and only misses the other players', and local dev is usually a
 * room of one. The stream chat is where it became obvious, because there the
 * host types nothing and every single word arrives over the socket.
 *
 * So the rule is: follow the API. If `NEXT_PUBLIC_API_URL` names an absolute
 * origin, the socket belongs to that origin; otherwise page and API share one
 * and `window.location` is correct.
 */

function protocolFor(httpProtocol: string): string {
  return httpProtocol === "https:" ? "wss:" : "ws:";
}

export function wsBase(): string {
  if (typeof window === "undefined") return "";

  const api = process.env.NEXT_PUBLIC_API_URL;
  if (api && /^https?:\/\//i.test(api)) {
    try {
      const url = new URL(api);
      return `${protocolFor(url.protocol)}//${url.host}/ws`;
    } catch {
      // A malformed value falls through to the same-origin answer, which is
      // what production uses anyway.
    }
  }

  return `${protocolFor(window.location.protocol)}//${window.location.host}/ws`;
}
