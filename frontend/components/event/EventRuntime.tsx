"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { SPOOKTOBER_2026, clearRetiredEventStorage } from "@/lib/event-theme";
import { useEventTheme } from "@/lib/use-event-theme";

/**
 * The seasonal event's behaviour, mounted once in the root layout.
 *
 * The skin itself is CSS and needs none of this. What is here is what moves
 * and what reacts, and it is a chunk of its own that is only requested while
 * the event is showing, so outside the window a visitor pays for this file
 * and nothing else.
 */
const HalloweenRuntime = dynamic(() => import("./halloween/HalloweenRuntime"), { ssr: false });

export default function EventRuntime() {
  const { event, active } = useEventTheme();

  useEffect(() => {
    try {
      clearRetiredEventStorage(window.localStorage);
    } catch {
      // Storage blocked: then nothing could have been left there either.
    }
  }, []);

  if (!active || event?.id !== SPOOKTOBER_2026.id) return null;
  return <HalloweenRuntime />;
}
