"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  ADCASH_ENABLED,
  ADCASH_SLOT_SIZES,
  ADCASH_ZONES,
  isAdcashPath,
  runAdcashBanner,
  type AdcashSlot,
} from "@/lib/adcash";
import { useAdConsent } from "@/lib/use-ad-consent";

/** Where the rails start: the game column is `max-w-lg`, so from 1280px each side has room for 160px plus gutter. */
const RAILS_QUERY = "(min-width: 1280px)";

type Layout = "rails" | "bar" | "server";

function subscribeLayout(onChange: () => void): () => void {
  const query = window.matchMedia(RAILS_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const getLayout = (): Layout => (window.matchMedia(RAILS_QUERY).matches ? "rails" : "bar");
const getServerLayout = (): Layout => "server";

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
 * app/globals.css and components/FeedbackFab.tsx).
 */
function BottomBar({ zoneId }: { zoneId: string }) {
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
      <Slot slot="bottomBar" zoneId={zoneId} className="flex flex-col items-center" onFilled={markFilled} />
    </div>
  );
}

/**
 * Adcash display banners, mounted once in the root layout: a 160x600 rail on
 * each side from 1280px, a 300x100 bar at the bottom below that. Nothing is
 * rendered, and aclib.js is never requested, without a stored consent, off the
 * two single-player pages, or for a zone that has no id yet.
 *
 * The key on each layout remounts the slots on a route change between `/` and
 * `/wordle/` and when the window crosses the breakpoint, so each view gets its
 * own ad instead of an empty container.
 */
export default function AdcashSlots() {
  const pathname = usePathname();
  const choice = useAdConsent();
  const layout = useSyncExternalStore(subscribeLayout, getLayout, getServerLayout);

  if (!ADCASH_ENABLED || choice !== "granted" || layout === "server" || !isAdcashPath(pathname)) {
    return null;
  }

  if (layout === "rails") {
    const { railLeft, railRight } = ADCASH_ZONES;
    return (
      <div key={`rails-${pathname}`}>
        {railLeft && (
          <Slot slot="railLeft" zoneId={railLeft} className="fixed top-1/2 left-4 z-10 -translate-y-1/2" />
        )}
        {railRight && (
          <Slot slot="railRight" zoneId={railRight} className="fixed top-1/2 right-4 z-10 -translate-y-1/2" />
        )}
      </div>
    );
  }

  const { bottomBar } = ADCASH_ZONES;
  return bottomBar ? <BottomBar key={`bar-${pathname}`} zoneId={bottomBar} /> : null;
}
