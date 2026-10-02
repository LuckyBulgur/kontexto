"use client";

import { useEffect, useRef, useState } from "react";
import { Coins, Gem, Gift, Star, UserPlus, type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/design";
import ChatIdentity from "@/components/live/ChatIdentity";
import { BOARD_COLUMN, BOARD_GRID } from "@/lib/board-layout";
import { fireSupportCelebration } from "@/lib/confetti";
import {
  FOLLOW_TOAST_MS,
  MAX_FOLLOWS_WAITING,
  TOAST_GAP_MS,
  TOAST_MS,
  admitToast,
  celebrationOf,
  celebrationStyle,
  eventActionParts,
  eventDetail,
  followAction,
  isFreeEvent,
  queuedToastMs,
  rainParticles,
  takeFollowToast,
  type Celebration,
  type CelebrationIcon,
  type FollowToast as FollowToastData,
} from "@/lib/live-events";
import type { LiveBadgeCatalog, LiveEvent } from "@/lib/live-types";
import { cn } from "@/lib/utils";

/**
 * Paid support on the host page: every event is a toast at the bottom centre
 * with confetti, louder the more it cost (`celebrationOf`).
 *
 * One toast at a time, the streamer's decision: everything else waits in one
 * queue and drops in after the one before has left, TOAST_GAP_MS later. Paid
 * support goes first, in arrival order; follows come when no paid toast is
 * waiting, and a long run of them folds into one toast that names the first and
 * counts the rest (`takeFollowToast`). A full queue lets a follow and then a small one
 * give way (`admitToast`), and a long queue shortens each toast
 * (`queuedToastMs`) so the last gift of a burst is thanked while it is news.
 *
 * Bottom centre and as wide as the board, the streamer's decision: most
 * streamers capture the board region only and a corner would fall outside the
 * picture. Nothing stands over the middle of the board, and there is no timer
 * bar: the toast
 * leaves by itself. Only while the tab is visible: what arrives in a hidden tab
 * waits and plays when the host looks again. It celebrates and nothing else:
 * the round, the ranks and the tips never see an event.
 */

/** Matched to `animate-support-out`. */
const EXIT_MS = 200;

const ICONS: Record<CelebrationIcon, LucideIcon> = {
  gem: Gem,
  star: Star,
  gift: Gift,
  coins: Coins,
  follow: UserPlus,
};

type PaidToast = { type: "paid"; id: number; event: LiveEvent; level: Celebration; leaving: boolean };
type FollowToastItem = { type: "follow"; id: number; follow: FollowToastData; level: "follow"; leaving: boolean };
type Toast = PaidToast | FollowToastItem;

/** TikTok's pink, the colour the platform gives its own follow notice. */
const FOLLOW_COLOR = "#fe2c55";

const numberFormat = new Intl.NumberFormat("de-DE");
const formatNumber = (value: number) => numberFormat.format(value);

const LEVEL_CLASS: Record<Celebration, { box: string; glyph: string; name: string; action: string }> = {
  small: { box: "gap-3 p-3.5", glyph: "size-9", name: "font-display text-lead font-bold", action: "text-body" },
  banner: { box: "gap-3.5 p-4", glyph: "size-11", name: "font-display text-h3 font-bold", action: "text-body" },
  big: { box: "gap-4 p-5", glyph: "size-12", name: "font-display text-h2 font-bold", action: "text-lead" },
  epic: { box: "gap-5 p-6", glyph: "size-16", name: "font-display text-h1 font-bold", action: "text-lead" },
};

function FollowToast({ toast, catalog }: { toast: FollowToastItem; catalog: LiveBadgeCatalog }) {
  const { follow, leaving } = toast;
  return (
    <div
      data-testid="live-follow-toast"
      data-others={follow.others}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl bg-popover px-4 py-3 text-popover-foreground shadow-lg",
        leaving ? "animate-support-out" : "animate-support-in"
      )}
    >
      <UserPlus aria-hidden className="size-6 shrink-0" style={{ color: FOLLOW_COLOR }} />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5">
        <ChatIdentity
          name={follow.actor}
          platform={follow.platform}
          badges={follow.badges}
          catalog={catalog}
          size="lg"
          nameClassName="font-semibold text-lead"
          className="max-w-full"
        />
        <span className="text-body text-foreground">{followAction(follow.others)}</span>
      </div>
    </div>
  );
}

function SupportToast({ toast, catalog }: { toast: PaidToast; catalog: LiveBadgeCatalog }) {
  const ref = useRef<HTMLDivElement>(null);
  const { event, level, leaving } = toast;
  const style = celebrationStyle(event);
  const parts = eventActionParts(event);
  const detail = eventDetail(event);
  const sizes = LEVEL_CLASS[level];
  const Icon = ICONS[style.icon];

  // Once per toast, from where it stands after its first layout.
  const fired = useRef(false);
  useEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (fired.current || !box) return;
    fired.current = true;
    void fireSupportCelebration(level, style, box, rainParticles(event));
  }, [level, style, event]);

  return (
    <div
      ref={ref}
      data-testid="live-support-toast"
      data-kind={event.kind}
      data-level={level}
      className={cn(
        "flex w-full items-center rounded-2xl bg-popover text-popover-foreground shadow-lg",
        sizes.box,
        leaving ? "animate-support-out" : "animate-support-in"
      )}
    >
      {event.gift_image ? (
        // A TikTok gift picture from TikTok's CDN, checked server side.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.gift_image}
          alt=""
          width={48}
          height={48}
          referrerPolicy="no-referrer"
          className={cn("shrink-0 object-contain animate-support-pop", sizes.glyph)}
        />
      ) : (
        <Icon
          aria-hidden
          className={cn("shrink-0 animate-support-pop", sizes.glyph)}
          style={{ color: style.colors[0] }}
        />
      )}
      <div className="min-w-0 flex-1">
        <ChatIdentity
          name={event.actor}
          platform={event.platform}
          badges={event.badges}
          catalog={catalog}
          size="lg"
          nameClassName={sizes.name}
          className="max-w-full"
        />
        <p className={cn("text-foreground", sizes.action)}>
          {parts.before}
          {parts.value !== null && (
            <CountUp value={parts.value} format={formatNumber} className="font-bold tabular-nums" />
          )}
          {parts.after}
        </p>
        {detail && <p className="text-small text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}

type WaitingPaid = { event: LiveEvent; level: Celebration };

export default function SupportToasts({
  events,
  catalog,
}: {
  /** New events to celebrate, in arrival order. Seen ids are skipped. */
  events: readonly LiveEvent[];
  catalog: LiveBadgeCatalog;
}) {
  const known = useRef<Set<number>>(new Set());
  const [waiting, setWaiting] = useState<WaitingPaid[]>([]);
  const [waitingFollows, setWaitingFollows] = useState<LiveEvent[]>([]);
  const [current, setCurrent] = useState<{ toast: Toast; duration: number } | null>(null);
  const [visible, setVisible] = useState(true);
  // When the last toast was gone, so the next keeps TOAST_GAP_MS from it.
  const lastGoneAt = useRef(0);

  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    const fresh = events.filter((event) => !known.current.has(event.id));
    for (const event of events) known.current.add(event.id);
    if (fresh.length === 0) return;
    const paid = fresh.filter((event) => !isFreeEvent(event));
    const follows = fresh.filter(isFreeEvent);
    if (paid.length > 0) {
      setWaiting((pending) =>
        paid.reduce<WaitingPaid[]>(
          (queue, event) => admitToast(queue, { event, level: celebrationOf(event) }),
          pending
        )
      );
    }
    if (follows.length > 0) {
      setWaitingFollows((pending) => [...pending, ...follows].slice(-MAX_FOLLOWS_WAITING));
    }
  }, [events]);

  // The next toast takes the one place once it is free, TOAST_GAP_MS after the
  // last one left, and only while somebody can see it.
  useEffect(() => {
    if (current || !visible) return;
    if (waiting.length === 0 && waitingFollows.length === 0) return;
    const wait = Math.max(0, lastGoneAt.current + TOAST_GAP_MS - Date.now());
    const timer = window.setTimeout(() => {
      if (waiting.length > 0) {
        const [next, ...rest] = waiting;
        const behind = rest.length + (waitingFollows.length > 0 ? 1 : 0);
        setWaiting(rest);
        setCurrent({
          toast: { type: "paid", id: next.event.id, event: next.event, level: next.level, leaving: false },
          duration: queuedToastMs(TOAST_MS[next.level], behind),
        });
        return;
      }
      const taken = takeFollowToast(waitingFollows);
      if (!taken) return;
      setWaitingFollows(taken.rest);
      setCurrent({
        toast: { type: "follow", id: taken.toast.id, follow: taken.toast, level: "follow", leaving: false },
        duration: queuedToastMs(FOLLOW_TOAST_MS, taken.rest.length),
      });
    }, wait);
    return () => window.clearTimeout(timer);
  }, [current, visible, waiting, waitingFollows]);

  // Stand, then leave, then free the place. Keyed by the toast id, so a state
  // update that keeps the same toast does not restart its clock.
  const currentId = current?.toast.id;
  const currentDuration = current?.duration;
  const currentLeaving = current?.toast.leaving ?? false;
  useEffect(() => {
    if (currentId === undefined || currentDuration === undefined) return;
    if (!currentLeaving) {
      const timer = window.setTimeout(() => {
        setCurrent((shown) =>
          shown && shown.toast.id === currentId
            ? { ...shown, toast: { ...shown.toast, leaving: true } }
            : shown
        );
      }, currentDuration);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      lastGoneAt.current = Date.now();
      setCurrent((shown) => (shown && shown.toast.id === currentId ? null : shown));
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [currentId, currentDuration, currentLeaving]);

  const toast = current?.toast;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pb-[env(safe-area-inset-bottom,0px)]",
        BOARD_GRID
      )}
    >
      {/* The same columns as the page, so the toast is as wide as the board and
          stands under it, wherever the board sits in this band. */}
      <div className={cn("flex flex-col items-stretch", BOARD_COLUMN)}>
        {toast &&
          (toast.type === "follow" ? (
            <FollowToast key={toast.id} toast={toast} catalog={catalog} />
          ) : (
            <SupportToast key={toast.id} toast={toast} catalog={catalog} />
          ))}
      </div>
    </div>
  );
}
