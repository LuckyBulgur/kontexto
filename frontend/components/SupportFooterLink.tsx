"use client";

import { reportSupportOpen } from "@/lib/analytics";
import { SUPPORT_LABEL, SUPPORT_URL } from "@/lib/support";

/**
 * The footer's way to Ko-fi: a plain link to ko-fi.com in a new tab, the one
 * entry that needs no script at all. It counts the click like the other entry
 * points, so the dashboard can say which of them people actually use.
 */
export default function SupportFooterLink({ className }: { className?: string }) {
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => void reportSupportOpen("footer")}
      className={className}
    >
      {SUPPORT_LABEL}
    </a>
  );
}
