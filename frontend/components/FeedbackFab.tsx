"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFeatureDiscovery } from "@/lib/feature-discovery";

/**
 * Permanent entry point to the contact page, anchored in the bottom right
 * corner of every gameplay and content page.
 *
 * It used to live in the kebab menu of the two headers, where it was reachable
 * only after opening a menu, and not at all on pages without a header (blog,
 * SEO pages, mode overview). As a floating button it keeps one fixed place, so
 * a player who wants to report a bad solution word does not have to look for
 * it. The one-time ping is the same discovery hint the menu entry carried.
 */

// Pages that either are the target itself or run their own chrome, where a
// floating game affordance would be wrong.
const HIDDEN_PREFIXES = ["/kontakt", "/admin"];

export default function FeedbackFab() {
  const pathname = usePathname();
  const { highlight, dismiss } = useFeatureDiscovery("kontexto_feedback_discovered");

  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  return (
    <Link
      href="/kontakt/"
      onClick={() => {
        if (highlight) dismiss();
      }}
      aria-label={highlight ? "Feedback und Wünsche, neue Funktion" : "Feedback und Wünsche"}
      title="Feedback und Wünsche"
      className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <MessageSquare className="h-5 w-5" aria-hidden />
      {highlight && (
        <span className="absolute right-0.5 top-0.5 flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
      )}
    </Link>
  );
}
