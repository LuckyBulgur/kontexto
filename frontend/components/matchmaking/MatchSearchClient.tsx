"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import Header from "@/components/Header";
import WordleHeader from "@/components/wordle/WordleHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { cancelMatch, enqueueForMatch, getMatchStatus } from "@/lib/matchmaking-api";
import {
  PARTY_RULES,
  loadSentence,
  partySizeLabel,
  waitingSentence,
} from "@/lib/matchmaking-rules";
import { MatchmakingTicket, QueueModeId, roomPath } from "@/lib/matchmaking-types";
import { MULTIPLAYER_MODES, isQueueMode } from "@/lib/multiplayer-modes";
import { useMatchmakingLive } from "@/lib/use-matchmaking-live";
import { cn } from "@/lib/utils";

interface MatchSearchClientProps {
  /** The modes this queue screen offers, in display order. */
  modes: QueueModeId[];
  /** Which game this queue belongs to, which decides the header. The two games
   *  do not share one, and the header carries the way back into its own game. */
  game: "kontexto" | "wordle";
  title: string;
  description: string;
  /** Only Wordle has a page to go back to. The Kontexto queue goes back to the
   *  question it came from, which is the dialog, not the catalogue page. */
  backHref?: string;
}

/** How often the waiting screen asks whether a room has been built. */
const POLL_INTERVAL_MS = 1500;

function modeFromQuery(allowed: QueueModeId[]): QueueModeId | null {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("modus");
  if (!requested || !isQueueMode(requested)) return null;
  return allowed.includes(requested) ? requested : null;
}

/**
 * The search for strangers.
 *
 * Polling, not a socket: the wait is short, one small request every one and a
 * half seconds is cheaper than a connection per waiting player, and the static
 * export has no server to hold one open on this page anyway.
 *
 * The screen states the start rule rather than leaving the player to guess at
 * it. Nobody presses start here and nobody sets a party size: the server pairs
 * as soon as enough people are queued. A per-player size setting would split one
 * queue into several, and a split queue is a queue that never fills.
 *
 * The screen serves both games, which is why the modes and the header come from
 * outside: Kontexto queues five modes under its own header, Wordle queues its
 * one duel under the Wordle header. With a single mode the list is dropped,
 * because a choice of one is not a choice.
 */
export default function MatchSearchClient({
  modes,
  game,
  title,
  description,
  backHref,
}: MatchSearchClientProps) {
  const single = modes.length === 1 ? modes[0] : null;
  const [mode, setMode] = useState<QueueModeId | null>(single);
  const [nickname, setNickname] = useState("");
  const [ticket, setTicket] = useState<MatchmakingTicket | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const searchingSince = useRef<number | null>(null);

  // Only while choosing. Once a ticket exists the waiting screen has the real
  // number from its own poll, and a second one would contradict it.
  const live = useMatchmakingLive(ticket === null);

  useEffect(() => {
    if (single) return;
    setMode(modeFromQuery(modes));
  }, [single, modes]);

  // Leaving the page must leave the queue too, or the next player is paired
  // with a tab that is already gone.
  useEffect(() => {
    if (!ticket) return;
    const id = ticket.ticket;
    const release = () => {
      navigator.sendBeacon?.(
        `${process.env.NEXT_PUBLIC_API_URL || "/api"}/matchmaking/cancel`,
        new Blob([JSON.stringify({ ticket: id })], { type: "application/json" })
      );
    };
    window.addEventListener("pagehide", release);
    return () => window.removeEventListener("pagehide", release);
  }, [ticket]);

  useEffect(() => {
    if (!ticket) return;
    const id = ticket.ticket;
    let cancelled = false;

    const tick = async () => {
      try {
        const status = await getMatchStatus(id);
        if (cancelled) return;
        setWaiting(status.waiting);
        if (status.matched && status.room_id && status.player_token) {
          storeRoomToken(status.mode, status.room_id, status.player_token);
          window.location.href = roomPath(status.mode, status.room_id);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        if (e instanceof Error && e.message === "ticket_not_found") {
          setTicket(null);
          setError("Die Suche ist abgelaufen. Starte sie neu.");
        }
      }
    };

    void tick();
    const poll = setInterval(tick, POLL_INTERVAL_MS);
    const clock = setInterval(() => {
      if (searchingSince.current) {
        setElapsed(Math.floor((Date.now() - searchingSince.current) / 1000));
      }
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [ticket]);

  const handleSearch = useCallback(async () => {
    if (!mode) return;
    setError(null);
    try {
      const created = await enqueueForMatch(mode, nickname);
      searchingSince.current = Date.now();
      setElapsed(0);
      setWaiting(0);
      setTicket(created);
    } catch {
      setError("Die Suche konnte nicht gestartet werden");
    }
  }, [mode, nickname]);

  const handleCancel = useCallback(async () => {
    if (!ticket) return;
    await cancelMatch(ticket.ticket);
    setTicket(null);
    searchingSince.current = null;
  }, [ticket]);

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      {game === "wordle" ? (
        <WordleHeader backHref={backHref} />
      ) : (
        <Header
          onTip={() => {}}
          onGiveUp={() => {}}
          onHowToPlayOpen={() => {}}
          onSettingsOpen={() => {}}
          onPastGamesOpen={() => {}}
          hideTip
          hideGiveUp
          hidePastGames
          backOpensModes
        />
      )}

      <div className="flex-1 px-4 py-4">
        {ticket ? (
          <WaitingCard
            ticket={ticket}
            waiting={waiting}
            elapsed={elapsed}
            onCancel={handleCancel}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {single ? (
                <SingleModeNote mode={single} live={live} />
              ) : (
              <div className="space-y-2">
                <Label className="text-micro font-semibold text-muted-foreground">
                  Modus
                </Label>
                <RadioGroup
                  value={mode ?? ""}
                  onValueChange={(value) => setMode(value as QueueModeId)}
                  className="gap-2"
                >
                  {modes.map((id) => {
                    const entry = MULTIPLAYER_MODES[id];
                    const rule = PARTY_RULES[id];
                    return (
                      <Label
                        key={id}
                        htmlFor={`modus-${id}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 font-normal transition-colors",
                          mode === id ? "border-primary bg-primary/5" : "hover:bg-accent"
                        )}
                      >
                        <RadioGroupItem value={id} id={`modus-${id}`} className="mt-1.5" />
                        {/* Three lines at one size is a list nobody scans. The
                            name leads, the pitch follows, the party rule is the
                            fine print it actually is. */}
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-display text-lead font-bold">{entry.name}</span>
                          <span className="text-small text-muted-foreground">{entry.hook}</span>
                          <span className="text-micro text-muted-foreground/80">
                            {partySizeLabel(rule)}
                            {rule.graceSeconds > 0
                              ? `, Start nach spätestens ${rule.graceSeconds} Sekunden`
                              : ", Start sofort zu zweit"}
                          </span>
                          {/* The line keeps its height before the figure
                              arrives, so the list does not jump under the
                              finger that is about to tap it. */}
                          <span className="min-h-[1lh] text-micro text-muted-foreground/80">
                            {loadSentence(live?.modes[id])}
                          </span>
                        </span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="nickname">Dein Name (optional)</Label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ohne Eingabe bekommst du einen Namen"
                  maxLength={20}
                  autoComplete="off"
                />
              </div>

              {error && <p className="text-small text-destructive">{error}</p>}

              <Button onClick={handleSearch} disabled={!mode} className="w-full">
                Mitspieler suchen
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/** What the list would have said about the one mode on offer. */
function SingleModeNote({
  mode,
  live,
}: {
  mode: QueueModeId;
  live: ReturnType<typeof useMatchmakingLive>;
}) {
  const entry = MULTIPLAYER_MODES[mode];
  const rule = PARTY_RULES[mode];
  return (
    <div className="rounded-lg border p-3.5">
      <p className="font-display text-lead font-bold">{entry.name}</p>
      <p className="text-small text-muted-foreground">{entry.tagline}</p>
      <p className="text-micro text-muted-foreground/80">
        {partySizeLabel(rule)}
        {rule.graceSeconds > 0
          ? `, Start nach spätestens ${rule.graceSeconds} Sekunden`
          : ", Start sofort zu zweit"}
      </p>
      <p className="min-h-[1lh] text-micro text-muted-foreground/80">
        {loadSentence(live?.modes[mode])}
      </p>
    </div>
  );
}

function WaitingCard({
  ticket,
  waiting,
  elapsed,
  onCancel,
}: {
  ticket: MatchmakingTicket;
  waiting: number;
  elapsed: number;
  onCancel: () => void;
}) {
  const mode = MULTIPLAYER_MODES[ticket.mode];

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Suche Mitspieler</CardTitle>
        <CardDescription>
          {[mode.name, `${waiting} in der Warteschlange`, `${elapsed} Sekunden`].join(", ")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <Spinner className="mx-auto size-6 text-primary" />

        <p className="text-small">{waitingSentence(waiting, ticket)}</p>

        <div className="rounded-lg border bg-muted/40 p-3 text-left text-micro text-muted-foreground">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Wann startet die Runde?
          </p>
          <p>
            {`Sobald ${ticket.min_players} Leute warten, spätestens ${ticket.grace_seconds} Sekunden danach. Bei ${ticket.max_players} geht es sofort los. Niemand drückt hier auf Start, das macht der Server.`}
          </p>
        </div>

        <p className="text-small">
          {"Du spielst als "}
          <strong>{ticket.nickname}</strong>
        </p>
        <Button variant="outline" onClick={onCancel}>
          Suche abbrechen
        </Button>
      </CardContent>
    </Card>
  );
}

/** Each mode reads its player token from its own key, so write the right one. */
function storeRoomToken(mode: QueueModeId, roomId: string, token: string): void {
  const key =
    mode === "duel"
      ? `kontexto_duel_${roomId}`
      : mode === "koop"
        ? `kontexto_koop_${roomId}`
        : mode === "wordle_duel"
          ? `wordle_duel_${roomId}`
          : `kontexto_arena_${roomId}`;
  try {
    localStorage.setItem(key, token);
  } catch {
    /* a blocked storage costs the auto-join, not the round */
  }
}
