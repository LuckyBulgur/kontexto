"use client";

import { Radio, Trophy } from "lucide-react";
import { Panel } from "@/components/design";
import { Button } from "@/components/ui/button";
import { ChatState, LiveViewer } from "@/lib/live-types";
import { cn } from "@/lib/utils";

const STATE_TEXT: Record<ChatState, string> = {
  connecting: "Verbindet sich mit dem Chat …",
  live: "Chat wird mitgelesen",
  error: "Der Chat lässt sich nicht lesen",
};

interface LiveStatusProps {
  channel: string;
  chatState: ChatState;
  chatError: string | null;
  requirePrefix: boolean;
  top: LiveViewer[];
  overlayUrl: string | null;
  onCopyOverlay: () => void;
}

/**
 * The sidebar of a stream-chat room: is the chat being read, what does the chat
 * have to do, where is the overlay, and who is carrying the evening.
 *
 * It stands where the koop board shows its player list, because a live room has
 * exactly one player row, the host. The people playing are in the chat, and the
 * honest way to show them is the leaderboard below.
 */
export default function LiveStatus({
  channel,
  chatState,
  chatError,
  requirePrefix,
  top,
  overlayUrl,
  onCopyOverlay,
}: LiveStatusProps) {
  return (
    <div className="flex w-full flex-col gap-3 md:w-64">
      <Panel padding="sm" className="gap-2">
        <div className="flex items-center gap-2">
          <Radio
            className={cn(
              "h-4 w-4 shrink-0",
              chatState === "live"
                ? "text-success-ink"
                : chatState === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
            )}
            aria-hidden
          />
          <span className="min-w-0 truncate font-display text-lead font-bold">
            {channel}
          </span>
        </div>
        <p className="text-micro text-muted-foreground">
          {chatState === "error" && chatError ? chatError : STATE_TEXT[chatState]}
        </p>
        <p className="text-micro text-muted-foreground/80">
          {requirePrefix
            ? "Dein Chat rät mit: !k wort"
            : "Dein Chat rät mit: ein Wort pro Nachricht"}
        </p>
      </Panel>

      {overlayUrl && (
        <Panel padding="sm" className="gap-2">
          <span className="text-micro font-semibold text-muted-foreground">
            {"Einblendung für OBS"}
          </span>
          <p className="text-micro text-muted-foreground/80">
            {"Als Browserquelle einfügen, 480 mal 640, Hintergrund bleibt transparent."}
          </p>
          <Button variant="outline" size="sm" onClick={onCopyOverlay} className="w-full">
            {"Link kopieren"}
          </Button>
        </Panel>
      )}

      <Panel padding="sm" className="gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-micro font-semibold text-muted-foreground">
            {"Fleißigste im Chat"}
          </span>
        </div>
        {top.length === 0 ? (
          <p className="text-micro text-muted-foreground/80">
            {"Noch hat niemand geraten."}
          </p>
        ) : (
          <ol className="flex list-none flex-col gap-1">
            {top.map((viewer, index) => (
              <li
                key={`${viewer.nickname}-${index}`}
                className="flex items-baseline justify-between gap-2 text-small"
              >
                <span className="min-w-0 truncate">{viewer.nickname}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {viewer.hits}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
