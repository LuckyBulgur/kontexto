"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Wordmark } from "@/components/design";
import { Button } from "@/components/ui/button";
import { HOST_MESSAGE_DURATION_MS, freshHostMessages } from "@/lib/host-messages";
import type { LiveHostMessage } from "@/lib/live-types";

/**
 * A note from the operator to the streamer, dropped in from the top like a
 * phone notification.
 *
 * It asks for nothing: no backdrop, no focus grab, no button that must be
 * pressed. It stays for HOST_MESSAGE_DURATION_MS and leaves by itself; the X
 * only lets it go sooner. Nothing holds it: a hover pause kept it standing
 * whenever the pointer came down from the tab strip onto it. Only the card
 * takes pointer events, so the board under the empty part of the strip stays
 * usable.
 *
 * It lives on the host page only and never on the OBS overlay, because the
 * overlay is what the audience sees. A note is only started while the tab is
 * visible: a streamer who keeps this tab behind OBS gets it the moment they
 * look, instead of it having played to nobody.
 */

/** How long the card takes to leave, matched to `animate-banner-lift`. */
const EXIT_MS = 220;

export default function HostMessageBanner({
  messages,
  onShown,
}: {
  messages: readonly LiveHostMessage[];
  /** Called once per note, the moment it is on screen. */
  onShown: (id: number) => void;
}) {
  const known = useRef<Set<number>>(new Set());
  const [queue, setQueue] = useState<LiveHostMessage[]>([]);
  const [current, setCurrent] = useState<LiveHostMessage | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);
  const remaining = useRef(0);

  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    const fresh = freshHostMessages(messages, known.current);
    if (fresh.length === 0) return;
    for (const message of fresh) known.current.add(message.id);
    setQueue((pending) => [...pending, ...fresh]);
  }, [messages]);

  // Take the next note once the stage is empty and somebody can see it.
  useEffect(() => {
    if (current || !visible || queue.length === 0) return;
    const [next, ...rest] = queue;
    remaining.current = HOST_MESSAGE_DURATION_MS;
    setQueue(rest);
    setLeaving(false);
    setCurrent(next);
    onShown(next.id);
  }, [current, visible, queue, onShown]);

  // The clock runs while the tab is visible and keeps what is left when the
  // streamer switches away mid-note, instead of starting over.
  useEffect(() => {
    if (!current || leaving || !visible) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => setLeaving(true), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [current, leaving, visible]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => {
      setCurrent(null);
      setLeaving(false);
    }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4"
    >
      {current && (
        <div
          key={current.id}
          data-testid="host-message"
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-popover p-3 pl-4 text-popover-foreground shadow-lg ${
            leaving ? "animate-banner-lift" : "animate-banner-drop"
          }`}
        >
          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex items-baseline gap-2">
              <Wordmark asLink={false} className="text-small" />
              <span className="text-micro text-muted-foreground">{"Nachricht für dich"}</span>
            </div>
            <p className="mt-1 break-words text-small text-foreground">{current.text}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label="Nachricht schließen"
            onClick={() => setLeaving(true)}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
