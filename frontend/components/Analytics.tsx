"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sendHeartbeat, trackPageview } from "@/lib/analytics";

// While a page is open, ping the server on this interval so the admin dashboard
// can show a live "currently online" count. Wide enough to be cheap, short
// enough that the count tracks reality (the server presence window tolerates a
// couple of missed beats, e.g. a briefly throttled background tab).
const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Reads the marker of a shared result link (`?s=412`) and removes it from the
 * address bar right away, so it is neither shared on nor left in a bookmark. The
 * value is handed to the pageview beacon once and counted per page there.
 */
function takeShareMarker(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const marker = params.get("s");
  if (!marker || !/^(?:[0-9]{1,6}|u)$/.test(marker)) return null;
  params.delete("s");
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    window.location.pathname + (query ? `?${query}` : "") + window.location.hash,
  );
  return marker;
}

// Fires a pageview beacon on every (client-side) route change, and keeps a
// live-presence heartbeat running while the page stays open.
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) trackPageview(pathname, takeShareMarker());
  }, [pathname]);

  useEffect(() => {
    // The admin views the dashboard itself; excluding /admin keeps it from
    // counting itself as an online visitor.
    if (!pathname || pathname.startsWith("/admin")) return;

    const beat = () => sendHeartbeat(pathname, document.visibilityState === "visible");
    beat();
    const id = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
    // Refresh immediately when a backgrounded tab becomes visible again, so a
    // returning visitor reappears in the live count without waiting a full beat.
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return null;
}
