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
  openBag,
  startFlashlight,
} from "./controller";
import { saveProgress } from "@/lib/events/spooktober";
import { COPY } from "./copy";
import BatBackdrop from "./BatBackdrop";
import EffectStage from "./EffectStage";
import Flashlight from "./Flashlight";
import CandyBagDialog from "./CandyBagDialog";

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
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

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
          action: { label: COPY.announce.action, onClick: openBag },
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
          action: { label: COPY.announce.action, onClick: openBag },
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

  // The Konami code switches the lights off. Ignored while typing, so a word
  // with "b" and "a" in it never trips it.
  useEffect(() => {
    let position = 0;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === KONAMI[position]) {
        position += 1;
        if (position === KONAMI.length) {
          position = 0;
          startFlashlight();
        }
      } else if (key === "ArrowUp") {
        // A third up after two ups still leaves the last two as a valid start.
        position = position === 2 ? 2 : 1;
      } else {
        position = 0;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <BatBackdrop busy={busy} />
      <EffectStage />
      <Flashlight />
      <CandyBagDialog />
    </>
  );
}
