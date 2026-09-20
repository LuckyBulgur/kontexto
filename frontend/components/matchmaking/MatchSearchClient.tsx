"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cancelMatch, enqueueForMatch, getMatchStatus } from "@/lib/matchmaking-api";
import { QueueModeId, roomPath } from "@/lib/matchmaking-types";
import { MULTIPLAYER_MODES, MULTIPLAYER_MODE_ORDER, isQueueMode } from "@/lib/multiplayer-modes";
import { cn } from "@/lib/utils";

/** How often the waiting screen asks whether a room has been built. */
const POLL_INTERVAL_MS = 1500;

function modeFromQuery(): QueueModeId | null {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("modus");
  return requested && isQueueMode(requested) ? requested : null;
}

/**
 * The search for strangers.
 *
 * Polling, not a socket: the wait is short, one small request every one and a
 * half seconds is cheaper than a connection per waiting player, and the static
 * export has no server to hold one open on this page anyway.
 */
export default function MatchSearchClient() {
  const [mode, setMode] = useState<QueueModeId | null>(null);
  const [nickname, setNickname] = useState("");
  const [ticket, setTicket] = useState<string | null>(null);
  const [assignedName, setAssignedName] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const searchingSince = useRef<number | null>(null);

  useEffect(() => {
    setMode(modeFromQuery());
  }, []);

  // Leaving the page must leave the queue too, or the next player is paired
  // with a tab that is already gone.
  useEffect(() => {
    if (!ticket) return;
    const release = () => {
      navigator.sendBeacon?.(
        `${process.env.NEXT_PUBLIC_API_URL || "/api"}/matchmaking/cancel`,
        new Blob([JSON.stringify({ ticket })], { type: "application/json" })
      );
    };
    window.addEventListener("pagehide", release);
    return () => window.removeEventListener("pagehide", release);
  }, [ticket]);

  useEffect(() => {
    if (!ticket) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const status = await getMatchStatus(ticket);
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
      setAssignedName(created.nickname);
      setTicket(created.ticket);
    } catch {
      setError("Die Suche konnte nicht gestartet werden");
    }
  }, [mode, nickname]);

  const handleCancel = useCallback(async () => {
    if (!ticket) return;
    await cancelMatch(ticket);
    setTicket(null);
    searchingSince.current = null;
  }, [ticket]);

  const meta = mode ? MULTIPLAYER_MODES[mode] : null;
  const nameWasReplaced =
    assignedName !== null && nickname.trim() !== "" && assignedName !== nickname.trim();

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      <Header
        onTip={() => {}}
        onGiveUp={() => {}}
        onHowToPlayOpen={() => {}}
        onFAQOpen={() => {}}
        onSettingsOpen={() => {}}
        onCreditsOpen={() => {}}
        onPastGamesOpen={() => {}}
        hideTip
        hideGiveUp
        hidePastGames
        hideDuelCreate
        hideKoopCreate
        backHref="/modi/"
      />

      <div className="flex-1 px-4 py-4">
        {ticket ? (
          <div className="rounded-xl border bg-card p-6 space-y-4 text-center">
            <h1 className="text-xl font-bold">Suche Mitspieler</h1>
            <p className="text-sm text-muted-foreground">
              {[
                meta?.name,
                `${elapsed} Sekunden`,
                waiting === 1 ? "nur du in der Warteschlange" : `${waiting} in der Warteschlange`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="text-sm">
              {"Du spielst als "}
              <strong>{assignedName}</strong>
            </p>
            {nameWasReplaced && (
              <p className="text-xs text-muted-foreground">
                {"Dein Wunschname geht so nicht. Fremde lesen ihn mit, deshalb dieser hier."}
              </p>
            )}
            <div
              className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary"
              aria-hidden
            />
            <Button variant="outline" onClick={handleCancel}>
              Suche abbrechen
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-6 space-y-5">
            <div className="space-y-1">
              <h1 className="text-xl font-bold">Gegen Fremde spielen</h1>
              <p className="text-sm text-muted-foreground">
                {"Kein Link, keine Verabredung. Modus wählen, kurz warten, losspielen."}
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Modus
              </legend>
              {MULTIPLAYER_MODE_ORDER.map((id) => {
                const entry = MULTIPLAYER_MODES[id];
                return (
                  <label
                    key={id}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                      mode === id ? "border-primary bg-primary/5" : "hover:bg-accent"
                    )}
                  >
                    <input
                      type="radio"
                      name="modus"
                      value={id}
                      checked={mode === id}
                      onChange={() => setMode(id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium">{entry.name}</span>
                      <span className="block text-xs text-muted-foreground">{entry.tagline}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="space-y-2">
              <label
                htmlFor="nickname"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Dein Name (optional)
              </label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ohne Eingabe bekommst du einen Namen"
                maxLength={20}
                autoComplete="off"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={handleSearch} disabled={!mode} className="w-full">
              Mitspieler suchen
            </Button>
          </div>
        )}
      </div>
    </div>
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
