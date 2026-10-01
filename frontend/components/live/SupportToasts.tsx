"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Coins, Gem, Gift, Star, type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/design";
import ChatIdentity from "@/components/live/ChatIdentity";
import { fireSupportCelebration } from "@/lib/confetti";
import {
  MAX_TOASTS,
  TOAST_MS,
  admitToast,
  celebrationOf,
  celebrationStyle,
  eventActionParts,
  eventDetail,
  rainParticles,
  type Celebration,
  type CelebrationIcon,
} from "@/lib/live-events";
import type { LiveBadgeCatalog, LiveEvent } from "@/lib/live-types";
import { cn } from "@/lib/utils";

/**
 * Paid support on the host page: every event is a toast at the bottom centre
 * with confetti, louder the more it cost (`celebrationOf`).
 *
 * Bottom centre and as wide as the board, because most streamers capture the
 * board region only and a corner would fall outside the picture. Nothing
 * stands over the middle of the board, and there is no timer bar: the toast
 * leaves by itself.
 *
 * At most MAX_TOASTS at once; a small one gives way first (`admitToast`). Only
 * while the tab is visible: what arrives in a hidden tab waits, capped at
 * MAX_WAITING, and plays when the host looks again. It celebrates and nothing
 * else: the round, the ranks and the tips never see an event.
 */

/** Matched to `animate-support-out`. */
const EXIT_MS = 200;

/** A page that slept through an hour should not play the hour back. */
const MAX_WAITING = 8;

/** Gap between two waiting toasts played after the tab comes back. */
const STAGGER_MS = 350;

const ICONS: Record<CelebrationIcon, LucideIcon> = {
  gem: Gem,
  star: Star,
  gift: Gift,
  coins: Coins,
};

interface Toast {
  event: LiveEvent;
  level: Celebration;
  leaving: boolean;
}

const numberFormat = new Intl.NumberFormat("de-DE");
const formatNumber = (value: number) => numberFormat.format(value);

const LEVEL_CLASS: Record<Celebration, { box: string; glyph: string; name: string; action: string }> = {
  small: { box: "gap-2.5 p-2.5", glyph: "size-7", name: "font-semibold", action: "text-small" },
  banner: { box: "gap-3 p-3", glyph: "size-9", name: "font-display text-lead font-bold", action: "text-small" },
  big: { box: "gap-3 p-3.5", glyph: "size-10", name: "font-display text-h3 font-bold", action: "text-body" },
  epic: { box: "gap-4 p-4", glyph: "size-12", name: "font-display text-h2 font-bold", action: "text-body" },
};

function SupportToast({ toast, catalog }: { toast: Toast; catalog: LiveBadgeCatalog }) {
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
          size={level === "small" ? "sm" : "lg"}
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
        {detail && <p className="text-micro text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}

export default function SupportToasts({
  events,
  catalog,
}: {
  /** New events to celebrate, in arrival order. Seen ids are skipped. */
  events: readonly LiveEvent[];
  catalog: LiveBadgeCatalog;
}) {
  const known = useRef<Set<number>>(new Set());
  const timers = useRef<Map<number, number[]>>(new Map());
  const [waiting, setWaiting] = useState<LiveEvent[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    const all = timers.current;
    return () => {
      for (const ids of all.values()) ids.forEach((id) => window.clearTimeout(id));
      all.clear();
    };
  }, []);

  useEffect(() => {
    const fresh = events.filter((event) => !known.current.has(event.id));
    for (const event of events) known.current.add(event.id);
    if (fresh.length === 0) return;
    setWaiting((pending) => [...pending, ...fresh].slice(-MAX_WAITING));
  }, [events]);

  const forget = useCallback((id: number) => {
    timers.current.get(id)?.forEach((timer) => window.clearTimeout(timer));
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (event: LiveEvent) => {
      const level = celebrationOf(event);
      setToasts((current) => {
        const next = admitToast(current, { event, level, leaving: false });
        for (const gone of current) {
          if (!next.includes(gone)) forget(gone.event.id);
        }
        return next;
      });
      const leave = window.setTimeout(() => {
        setToasts((current) =>
          current.map((toast) => (toast.event.id === event.id ? { ...toast, leaving: true } : toast))
        );
      }, TOAST_MS[level]);
      const remove = window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.event.id !== event.id));
        timers.current.delete(event.id);
      }, TOAST_MS[level] + EXIT_MS);
      timers.current.set(event.id, [leave, remove]);
    },
    [forget]
  );

  // One waiting event per step, so a burst that arrived in one poll (or while
  // the tab was hidden) plays as a short sequence instead of all at once.
  useEffect(() => {
    if (!visible || waiting.length === 0) return;
    const timer = window.setTimeout(() => {
      const [next, ...rest] = waiting;
      setWaiting(rest);
      show(next);
    }, toasts.length === 0 ? 0 : STAGGER_MS);
    return () => window.clearTimeout(timer);
  }, [visible, waiting, show, toasts.length]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex w-full max-w-lg flex-col items-stretch gap-2">
        {toasts.map((toast) => (
          <SupportToast key={toast.event.id} toast={toast} catalog={catalog} />
        ))}
      </div>
    </div>
  );
}
