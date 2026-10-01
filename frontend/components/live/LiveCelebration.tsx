"use client";

import { useEffect, useRef, useState } from "react";
import ChatIdentity from "@/components/live/ChatIdentity";
import { fireConfetti } from "@/lib/confetti";
import { celebrationOf, eventAction, eventDetail } from "@/lib/live-events";
import type { LiveBadgeCatalog, LiveEvent } from "@/lib/live-types";

/**
 * Paid support, risen in over the bottom of the board: the operator's note
 * mirrored, because the top of the page is where the host types.
 *
 * Only events loud enough for a banner come here (`celebrationOf`); the rest
 * are rows in the sidebar feed. One banner at a time, queued, each for
 * CELEBRATION_MS, and only while the tab is visible, so a sub train during a
 * break in another tab is not played to nobody. A big one adds confetti,
 * which `fireConfetti` already skips under reduced motion.
 *
 * It celebrates and nothing else: the round, the ranks and the tips never see
 * an event.
 */

export const CELEBRATION_MS = 4000;

/** Matched to `animate-celebration-sink`. */
const EXIT_MS = 220;

/** A queue that grows faster than it plays drops its oldest entries: a sub
 *  bomb of a hundred is one event already, and a page that slept through an
 *  hour should not play the hour back. */
const MAX_QUEUED = 8;

export default function LiveCelebration({
  events,
  catalog,
}: {
  /** New events to celebrate, in arrival order. Seen ids are skipped. */
  events: readonly LiveEvent[];
  catalog: LiveBadgeCatalog;
}) {
  const known = useRef<Set<number>>(new Set());
  const [queue, setQueue] = useState<LiveEvent[]>([]);
  const [current, setCurrent] = useState<LiveEvent | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    const fresh = events.filter(
      (event) => !known.current.has(event.id) && celebrationOf(event) !== "feed"
    );
    for (const event of events) known.current.add(event.id);
    if (fresh.length === 0) return;
    setQueue((pending) => [...pending, ...fresh].slice(-MAX_QUEUED));
  }, [events]);

  useEffect(() => {
    if (current || !visible || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setLeaving(false);
    setCurrent(next);
    if (celebrationOf(next) === "big") void fireConfetti();
  }, [current, visible, queue]);

  useEffect(() => {
    if (!current || leaving) return;
    const timer = window.setTimeout(() => setLeaving(true), CELEBRATION_MS);
    return () => window.clearTimeout(timer);
  }, [current, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => {
      setCurrent(null);
      setLeaving(false);
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const detail = current ? eventDetail(current) : null;
  const big = current ? celebrationOf(current) === "big" : false;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
    >
      {current && (
        <div
          key={current.id}
          data-testid="live-celebration"
          data-kind={current.kind}
          className={`flex w-full max-w-md items-center gap-3 rounded-2xl bg-popover p-3 pl-4 text-popover-foreground shadow-lg ${
            leaving ? "animate-celebration-sink" : "animate-celebration-rise"
          }`}
        >
          {current.gift_image && (
            // A TikTok gift picture from TikTok's CDN, checked server side.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.gift_image}
              alt=""
              width={40}
              height={40}
              referrerPolicy="no-referrer"
              className="size-10 shrink-0 object-contain"
            />
          )}
          <div className="min-w-0 flex-1">
            <ChatIdentity
              name={current.actor}
              platform={current.platform}
              badges={current.badges}
              catalog={catalog}
              size="lg"
              nameClassName={
                big ? "font-display text-h3 font-bold" : "font-display text-lead font-bold"
              }
              className="max-w-full"
            />
            <p className="mt-0.5 text-small text-foreground">{eventAction(current)}</p>
            {detail && <p className="text-micro text-muted-foreground">{detail}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
