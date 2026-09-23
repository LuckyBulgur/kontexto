"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  ADCASH_ENABLED,
  ADCASH_SLOT_SIZES,
  ADCASH_VIDEO_SLIDER_ZONE,
  ADCASH_ZONES,
  isAdcashPath,
  runAdcashBanner,
  runAdcashVideoSlider,
  type AdcashSlot,
} from "@/lib/adcash";
import { useAdConsent } from "@/lib/use-ad-consent";

/** Where the rails start: the game column is `max-w-lg`, so from 1280px each side has room for 160px plus gutter. */
const RAILS_QUERY = "(min-width: 1280px)";
/** Where the 728x90 bar fits with the bar's own padding on both sides. */
const LEADERBOARD_QUERY = "(min-width: 768px)";

type Layout = "rails" | "leaderboard" | "bar" | "server";

function subscribeLayout(onChange: () => void): () => void {
  const queries = [window.matchMedia(RAILS_QUERY), window.matchMedia(LEADERBOARD_QUERY)];
  for (const query of queries) query.addEventListener("change", onChange);
  return () => {
    for (const query of queries) query.removeEventListener("change", onChange);
  };
}
function getLayout(): Layout {
  if (window.matchMedia(RAILS_QUERY).matches) return "rails";
  if (window.matchMedia(LEADERBOARD_QUERY).matches) return "leaderboard";
  return "bar";
}
const getServerLayout = (): Layout => "server";

/**
 * Whether this document may show Adcash at all: the switch, a stored consent,
 * a game page and a rendered client. Every slot and the slider ask the same.
 */
function useAdcashAllowed(): { allowed: boolean; layout: Layout; pathname: string | null } {
  const pathname = usePathname();
  const choice = useAdConsent();
  const layout = useSyncExternalStore(subscribeLayout, getLayout, getServerLayout);
  const allowed = ADCASH_ENABLED && choice === "granted" && layout !== "server" && isAdcashPath(pathname);
  return { allowed, layout, pathname };
}

const LABEL = "Anzeige";

/**
 * One display zone. Mounted only for the layout that is on screen: an ad
 * placed into a container hidden by CSS counts an impression nobody saw, which
 * ad networks treat as invalid traffic.
 *
 * It stays invisible until Adcash actually puts something into it. Adcash
 * answers a zone without a matching ad with an empty 204 (measured on
 * 2026-09-23 for all three zones right after they were created), and without
 * this an empty "Anzeige" box would stand next to the game. The switch to
 * visible happens in the mutation callback, before the next paint, so the ad
 * is never on screen while its slot is hidden. A blocked aclib.js removes the
 * slot altogether.
 */
function Slot({
  slot,
  zoneId,
  className,
  onFilled,
}: {
  slot: AdcashSlot;
  zoneId: string;
  className: string;
  onFilled?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [filled, setFilled] = useState(false);
  const started = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const elementId = `adcash-${slot}`;
  const { width, height } = ADCASH_SLOT_SIZES[slot];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const check = () => {
      if (container.childElementCount > 0) {
        setFilled(true);
        onFilled?.();
        observer.disconnect();
      }
    };
    const observer = new MutationObserver(check);
    observer.observe(container, { childList: true });
    check();
    return () => observer.disconnect();
  }, [onFilled]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runAdcashBanner(zoneId, elementId).catch(() => setFailed(true));
  }, [zoneId, elementId]);

  if (failed) return null;

  return (
    <aside
      aria-label={LABEL}
      aria-hidden={filled ? undefined : true}
      className={filled ? className : `${className} invisible`}
      data-adcash-slot={slot}
      data-filled={filled ? "true" : "false"}
    >
      <span aria-hidden="true" className="mb-1 block text-center text-micro text-muted-foreground">
        {LABEL}
      </span>
      <div ref={containerRef} id={elementId} style={{ width, height }} />
    </aside>
  );
}

/**
 * The bottom bar sits over the page, so the page gets that much room at its
 * end, and the feedback button moves above it (`--ad-bar-height`, read in
 * app/globals.css and components/FeedbackFab.tsx). It carries the 728x90 zone
 * from 768px and the 300x100 zone below.
 */
function BottomBar({ slot, zoneId }: { slot: "leaderboard" | "bottomBar"; zoneId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [filled, setFilled] = useState(false);
  const markFilled = useCallback(() => setFilled(true), []);

  useEffect(() => {
    const element = ref.current;
    if (!element || !filled) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty("--ad-bar-height", `${element.offsetHeight}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--ad-bar-height");
    };
  }, [filled]);

  return (
    <div
      ref={ref}
      className={`fixed inset-x-0 bottom-0 z-40 flex justify-center bg-card px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-lg${filled ? "" : " invisible"}`}
    >
      <Slot slot={slot} zoneId={zoneId} className="flex flex-col items-center" onFilled={markFilled} />
    </div>
  );
}

/**
 * Starts the video slider once the page may show Adcash, on every width.
 * Adcash positions and closes the player itself; see `ADCASH_VIDEO_SLIDER_ZONE`.
 * A blocked aclib.js is swallowed, the game must not notice.
 */
function VideoSlider({ zoneId }: { zoneId: string }) {
  useEffect(() => {
    runAdcashVideoSlider(zoneId).catch(() => undefined);
  }, [zoneId]);
  return null;
}

/**
 * The 300x250 rectangle under the result of a finished round. Placed by each
 * game client right after its result card, so it exists only while a result
 * is on screen, and a new round's result gets a new ad.
 */
export function AdcashResultSlot({ className }: { className?: string }) {
  const { allowed } = useAdcashAllowed();
  const zoneId = ADCASH_ZONES.result;
  if (!allowed || !zoneId) return null;
  return <Slot slot="result" zoneId={zoneId} className={`flex flex-col items-center ${className ?? ""}`.trim()} />;
}

/**
 * Adcash in the root layout: a 160x600 rail on each side from 1280px, a
 * 728x90 bar at the bottom from 768px, a 300x100 bar below that, and the
 * video slider on every width. Nothing is rendered, and aclib.js is never
 * requested, without a stored consent, off the game pages (`isAdcashPath`),
 * or for a zone that has no id yet.
 *
 * The key on each layout remounts the slots on a route change between two game
 * pages and when the window crosses a breakpoint, so each view gets its
 * own ad instead of an empty container.
 */
export default function AdcashSlots() {
  const { allowed, layout, pathname } = useAdcashAllowed();
  if (!allowed) return null;

  const slider = ADCASH_VIDEO_SLIDER_ZONE ? <VideoSlider zoneId={ADCASH_VIDEO_SLIDER_ZONE} /> : null;

  if (layout === "rails") {
    const { railLeft, railRight } = ADCASH_ZONES;
    return (
      <>
        {slider}
        <div key={`rails-${pathname}`}>
          {railLeft && (
            <Slot slot="railLeft" zoneId={railLeft} className="fixed top-1/2 left-4 z-10 -translate-y-1/2" />
          )}
          {railRight && (
            <Slot slot="railRight" zoneId={railRight} className="fixed top-1/2 right-4 z-10 -translate-y-1/2" />
          )}
        </div>
      </>
    );
  }

  const slot = layout === "leaderboard" ? "leaderboard" : "bottomBar";
  const zoneId = ADCASH_ZONES[slot];
  return (
    <>
      {slider}
      {zoneId ? <BottomBar key={`${slot}-${pathname}`} slot={slot} zoneId={zoneId} /> : null}
    </>
  );
}
