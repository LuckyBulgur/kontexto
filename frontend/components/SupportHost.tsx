"use client";

import { usePathname } from "next/navigation";
import { Coffee, ExternalLink, Heart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  SUPPORT_COPY,
  SUPPORT_EMBED_URL,
  SUPPORT_URL,
  isKeyboardPage,
  isSupportPinnedPage,
} from "@/lib/support";
import { closeSupport, openSupport, useSupportOpen } from "@/lib/support-dialog";

/** Tailwind's `lg`. The button is pinned top right from here on a game page. */
const PINNED_QUERY = "(min-width: 1024px)";

/**
 * The always-visible Ko-fi button and the one dialog every way in opens.
 *
 * Bottom left on phones and on pages with a wide layout: where Ko-fi's own
 * floating widget sits, so the shape is known, and mirroring the feedback button
 * in the bottom right. On the single-column game pages from `lg` it stands
 * directly right of the header's menu button, outside the column, because a
 * header button is the placement with the strongest evidence for being seen
 * (NextAfter, Heritage Foundation test) and there it costs the game nothing.
 * Inside the header row it was rejected as squeezed in, and pinned to the
 * viewport's top right corner as too far away to notice.
 *
 * It stands on every page and in every mode, the live host page and the admin
 * dashboard included (the player's decision). It carries its word at every
 * width, because a cup alone is not recognisable as "support", and it never
 * draws attention to itself beyond that: no badge, no hint bubble, no timer.
 *
 * The iframe is mounted only while the dialog is open, so a page view loads
 * nothing from Ko-fi. The link under it is the way out for a browser that blocks
 * the frame.
 */
export default function SupportHost() {
  const pathname = usePathname();
  const open = useSupportOpen();
  const pinnedPage = isSupportPinnedPage(pathname);

  const onTrigger = () => {
    const pinned = pinnedPage && window.matchMedia(PINNED_QUERY).matches;
    openSupport(pinned ? "pinned" : "corner");
  };

  return (
    <>
      <button
        type="button"
        onClick={onTrigger}
        aria-label={SUPPORT_COPY.label}
        data-testid="support-fab"
        className={cn(
          "fixed bottom-4 left-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-primary pl-4 pr-5 text-small font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // From lg, directly right of the header's menu button: the game column
          // is max-w-lg (32rem) and centred, so its right edge is 50% + 16rem;
          // there it takes the header row's own height and line (pt-5, h-10), so it
          // reads as part of that row. Absolute, not fixed, so it scrolls away
          // with the header it belongs to.
          pinnedPage && "lg:absolute lg:bottom-auto lg:right-auto lg:top-5 lg:h-10 lg:left-[calc(50%+16rem)]",
          // Wördle's keyboard is the bottom row of a phone screen. Measured: from
          // 740 pixels of height 52 pixels are free under it, so on a phone the
          // button is flatter and closer to the edge there and stays clear of
          // Enter. On shorter phones the keyboard itself does not fit and the page
          // scrolls anyway; the button is never hidden (the player's decision).
          isKeyboardPage(pathname) && "max-sm:bottom-2 max-sm:left-2 max-sm:h-9 max-sm:gap-1.5 max-sm:pl-3 max-sm:pr-3.5",
        )}
      >
        <Coffee className="h-5 w-5" aria-hidden="true" />
        {SUPPORT_COPY.button}
      </button>
      <Dialog open={open} onOpenChange={(next) => (next ? undefined : closeSupport())}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-6">{SUPPORT_COPY.title}</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>{SUPPORT_COPY.intro}</p>
                <p>{SUPPORT_COPY.ask}</p>
                <p className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  {SUPPORT_COPY.thanks}
                  <Heart className="h-4 w-4 fill-destructive text-destructive" aria-hidden="true" />
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          {open && (
            // Ko-fi's panel starts flush with the top of its frame, and its own
            // embed code therefore wraps the iframe in padding on Ko-fi's panel
            // grey (`padding:4px;background:#f9f9f9`). The same frame here, a
            // little more room on top; the hex is Ko-fi's surface, not a token,
            // because it has to meet the page inside the iframe seamlessly.
            <div className="rounded-lg bg-[#f9f9f9] px-1 pb-1 pt-3">
              <iframe
                src={SUPPORT_EMBED_URL}
                title={SUPPORT_COPY.frameTitle}
                className="block h-[min(712px,calc(100dvh-19rem))] min-h-80 w-full border-0 bg-transparent"
              />
            </div>
          )}
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 justify-self-start text-small text-primary underline underline-offset-2 hover:no-underline"
          >
            {SUPPORT_COPY.openExternally}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </DialogContent>
      </Dialog>
    </>
  );
}
