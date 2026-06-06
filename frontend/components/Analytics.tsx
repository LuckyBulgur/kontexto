"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageview } from "@/lib/analytics";

// Fires a pageview beacon on every (client-side) route change.
export function Analytics() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) trackPageview(pathname);
  }, [pathname]);
  return null;
}
