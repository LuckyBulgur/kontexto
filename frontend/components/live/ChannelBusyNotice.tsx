"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Panel } from "@/components/design";
import { Button } from "@/components/ui/button";
import { copyTextToClipboard } from "@/lib/clipboard";
import { CHANNEL_BUSY_COPY } from "@/lib/live-copy";
import type { LivePlatform } from "@/lib/live-types";
import { cn } from "@/lib/utils";

/**
 * The way out for a streamer whose channel still holds a round, said so it
 * cannot be read past.
 *
 * It used to be the second sentence of a small red line under the create form,
 * and streamers kept pressing start without reading it. Now the word to type is
 * the largest thing on the screen, the block takes the place of whatever the
 * streamer would have pressed next, and it takes the focus, so a screen reader
 * announces it and the page scrolls to it.
 *
 * `state` decides the last line: `waiting` while the create form asks the server
 * by itself, `expired` once it stopped asking, `static` where nothing waits (the
 * add-chat form, the room landing).
 */
export default function ChannelBusyNotice({
  platform,
  state,
  headline = CHANNEL_BUSY_COPY.headline,
  footnote,
  autoFocus = true,
  onRetry,
  onCancel,
  className,
}: {
  /** The chat that is busy; TikTok gets the note that it only works while live. */
  platform: LivePlatform | null;
  state: "waiting" | "expired" | "static";
  headline?: string;
  /** One more sentence after the instruction, for the place it is shown in. */
  footnote?: string;
  /** Take the focus and scroll into view on mount; off where it is not the answer to a click. */
  autoFocus?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const box = ref.current;
    if (!box || !autoFocus) return;
    box.focus({ preventScroll: true });
    box.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [autoFocus]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    if (await copyTextToClipboard(CHANNEL_BUSY_COPY.word)) setCopied(true);
  };

  return (
    <Panel
      ref={ref}
      tone="accent"
      role="alert"
      tabIndex={-1}
      data-testid="channel-busy"
      data-state={state}
      className={cn("outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      <div className="space-y-1">
        <h2 className="text-h3">{headline}</h2>
        <p className="text-body">{CHANNEL_BUSY_COPY.instruction}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span
          data-testid="channel-busy-word"
          className="rounded-lg bg-primary px-6 py-2 font-display text-display leading-none text-primary-foreground"
        >
          {CHANNEL_BUSY_COPY.word}
        </span>
        <Button type="button" variant="outline" onClick={copy} aria-live="polite">
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? CHANNEL_BUSY_COPY.copied : CHANNEL_BUSY_COPY.copy}
        </Button>
      </div>

      <div className="space-y-1 text-small">
        {platform === "tiktok" && <p>{CHANNEL_BUSY_COPY.tiktokLive}</p>}
        {footnote && <p>{footnote}</p>}
        {state === "waiting" && (
          <p className="flex items-center gap-2 font-semibold" data-testid="channel-busy-waiting">
            <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
            {CHANNEL_BUSY_COPY.waiting}
          </p>
        )}
        {state === "expired" && <p className="font-semibold">{CHANNEL_BUSY_COPY.expired}</p>}
        {state !== "static" && <p>{CHANNEL_BUSY_COPY.fallback}</p>}
      </div>

      {(onRetry || onCancel) && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {state === "expired" && onRetry && (
            <Button type="button" className="flex-1" onClick={onRetry}>
              {CHANNEL_BUSY_COPY.retry}
            </Button>
          )}
          {onCancel && (
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
              {CHANNEL_BUSY_COPY.cancel}
            </Button>
          )}
        </div>
      )}
    </Panel>
  );
}
