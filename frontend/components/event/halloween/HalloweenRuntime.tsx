"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { getStage, setStage } from "./stage-store";
import {
  enterWitchingHour,
  hydrateProgress,
  isHalloweenDay,
  isWitchingHour,
  peekEyes,
  reachBottom,
} from "./controller";
import { saveProgress } from "@/lib/events/spooktober";
import { COPY } from "./copy";
import BatBackdrop from "./BatBackdrop";
import EffectStage from "./EffectStage";
import Flashlight from "./Flashlight";

/**
 * Everything Spooktober does on its own, mounted once in the root layout by
 * `components/event/EventRuntime.tsx` and only while the skin is on. This
 * module and everything it imports is a chunk of its own, so a visitor
 * outside October never downloads it.
 */

const FULL_MOON_CLASS = "spook-full-moon";
const HALLOWEEN_TOAST_KEY = "kontexto_spooktober_halloween_toast";
const FAVICON_ATTR = "data-spooktober";
/** The page colours of the event palette, for the browser chrome on phones. */
const THEME_COLOR = { light: "#fcf2e5", dark: "#120c1c" };
/** Quiet this long, and something looks back. */
const IDLE_EYES_MS = 25_000;
const EYES_SEEN_KEY = "kontexto_spooktober_eyes";
/** A page has to be this many screens tall before its end counts as "ganz unten". */
const BOTTOM_MIN_PAGES = 1.5;
const BOTTOM_SLACK_PX = 4;

function safeStorage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export default function HalloweenRuntime() {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  // The one-time announcement, and a second line on Halloween itself.
  useEffect(() => {
    hydrateProgress();
    const timer = window.setTimeout(() => {
      const { progress } = getStage();
      if (!progress.announced) {
        const next = { ...progress, announced: true };
        saveProgress(safeStorage("local"), next);
        setStage({ progress: next });
        toast(COPY.announce.title, {
          description: COPY.announce.description,
          duration: 9000,
        });
        return;
      }
      if (isHalloweenDay()) {
        const session = safeStorage("session");
        if (session?.getItem(HALLOWEEN_TOAST_KEY)) return;
        session?.setItem(HALLOWEEN_TOAST_KEY, "1");
        toast(COPY.announce.halloweenTitle, {
          description: COPY.announce.halloweenDescription,
          duration: 8000,
        });
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  // Witching hour and Halloween: full moon, more bats, the midnight secret.
  useEffect(() => {
    let enteredWitchingHour = false;
    const check = () => {
      const now = new Date();
      const witching = isWitchingHour(now);
      const special = witching || isHalloweenDay(now);
      document.documentElement.classList.toggle(FULL_MOON_CLASS, special);
      setBusy(special);
      if (witching && !enteredWitchingHour) {
        enteredWitchingHour = true;
        enterWitchingHour();
      }
      if (!witching) enteredWitchingHour = false;
    };
    check();
    const interval = window.setInterval(check, 60_000);
    return () => {
      window.clearInterval(interval);
      document.documentElement.classList.remove(FULL_MOON_CLASS);
    };
  }, []);

  // A pumpkin in the browser tab and night colours in the phone's chrome.
  useEffect(() => {
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    icon.href = "/event/halloween/icon.svg";
    icon.setAttribute(FAVICON_ATTR, "");
    document.head.appendChild(icon);

    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const previous = metas.map((m) => m.content);
    for (const meta of metas) {
      const dark = meta.media.includes("dark") || (!meta.media && document.documentElement.classList.contains("dark"));
      meta.content = dark ? THEME_COLOR.dark : THEME_COLOR.light;
    }
    return () => {
      icon.remove();
      metas.forEach((m, i) => {
        m.content = previous[i];
      });
    };
  }, []);

  // "Buh!" in the tab title while the player looks elsewhere. Not on the live
  // pages, whose window a streamer may be capturing.
  useEffect(() => {
    if (pathname.startsWith("/live")) return;
    let saved: string | null = null;
    const onVisibility = () => {
      if (document.hidden) {
        saved = document.title;
        document.title = COPY.tabAway;
      } else if (saved !== null) {
        if (document.title === COPY.tabAway) document.title = saved;
        saved = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (saved !== null && document.title === COPY.tabAway) document.title = saved;
    };
  }, [pathname]);

  // The very end of a long page: a hand waves from below (secret "Bodenlos").
  // Only on a page that really scrolls, or a short page would set it off on
  // load, and not on the live pages, which a streamer may be capturing.
  useEffect(() => {
    if (pathname.startsWith("/live")) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight > window.innerHeight * BOTTOM_MIN_PAGES;
      if (scrollable && window.scrollY + window.innerHeight >= doc.scrollHeight - BOTTOM_SLACK_PX) reachBottom();
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  // Eulenblick: after a while without any input, two eyes blink once out of a
  // dark corner. Once per browser session, and not on the live pages.
  useEffect(() => {
    if (pathname.startsWith("/live")) return;
    const session = safeStorage("session");
    if (session?.getItem(EYES_SEEN_KEY)) return;
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.hidden) return;
        try {
          session?.setItem(EYES_SEEN_KEY, "1");
        } catch {
          // Storage blocked: the eyes may come back on the next page.
        }
        peekEyes();
        detach();
      }, IDLE_EYES_MS);
    };
    const events = ["pointermove", "pointerdown", "keydown", "scroll", "touchstart"] as const;
    const detach = () => {
      window.clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, arm);
    };
    for (const e of events) window.addEventListener(e, arm, { passive: true });
    arm();
    return detach;
  }, [pathname]);

  return (
    <>
      <BatBackdrop busy={busy} />
      <EffectStage />
      <Flashlight />
    </>
  );
}
