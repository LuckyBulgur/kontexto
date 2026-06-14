"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sendHeartbeat, trackPageview } from "@/lib/analytics";

// While a page is open, ping the server on this interval so the admin dashboard
// can show a live "currently online" count. Wide enough to be cheap, short
// enough that the count tracks reality (the server presence window tolerates a
// couple of missed beats, e.g. a briefly throttled background tab).
const HEARTBEAT_INTERVAL_MS = 20_000;

// Fires a pageview beacon on every (client-side) route change, and keeps a
// live-presence heartbeat running while the page stays open.
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) trackPageview(pathname);
  }, [pathname]);

  useEffect(() => {
    // The admin views the dashboard itself; excluding /admin keeps it from
    // counting itself as an online visitor.
    if (!pathname || pathname.startsWith("/admin")) return;

    sendHeartbeat(pathname);
    const id = window.setInterval(() => sendHeartbeat(pathname), HEARTBEAT_INTERVAL_MS);
    // Refresh immediately when a backgrounded tab becomes visible again, so a
    // returning visitor reappears in the live count without waiting a full beat.
    const onVisible = () => {
      if (document.visibilityState === "visible") sendHeartbeat(pathname);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  return null;
}
