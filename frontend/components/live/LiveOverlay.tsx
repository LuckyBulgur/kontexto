"use client";

import { useEffect, useState } from "react";
import { RevealWord } from "@/components/design";
import GuessBar from "@/components/GuessBar";
import PlatformMark from "@/components/live/PlatformMark";
import { showsPlatformMarks } from "@/lib/live-channel";
import { getOverlayState } from "@/lib/live-api";
import { LiveOverlayState } from "@/lib/live-types";

/**
 * The OBS browser source.
 *
 * No header, no navigation, no background: it is laid over a video, so anything
 * it draws has to earn the pixels it covers. What it shows is the last few
 * guesses with their ranks, who is carrying the chat, and the solved word when
 * the round ends. Once two chats play, every name carries its platform logo.
 * A paused chat is not shown as such: the audience would read it as a fault.
 *
 * It polls rather than opening a socket. The koop broadcast reads SQLite once a
 * second itself, so a socket would buy at most one second of freshness and cost
 * a second connection manager; the data shape would not change if that second
 * ever turns out to matter.
 *
 * It never receives the game number or the target word while the round is open.
 * This view points at an audience, and the number is the answer (rooms.py).
 */

const POLL_MS = 1000;

export default function LiveOverlay() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<LiveOverlayState | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      try {
        const next = await getOverlayState(token);
        if (cancelled) return;
        setState(next);
        setMissing(false);
      } catch {
        if (!cancelled) setMissing(true);
      }
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);

  // A round that was running and then ended leaves nothing on the stream. The
  // sentence below is for the streamer setting the source up, and printing it
  // into a live broadcast would be the one thing the audience reads.
  if (missing && state) return <div data-obs data-ended />;

  if (!token || missing) {
    return (
      <div data-obs className="p-4 font-sans text-small text-muted-foreground">
        {"Diese Einblendung gehört zu keiner laufenden Runde."}
      </div>
    );
  }

  if (!state) return <div data-obs />;

  const recent = state.recent.slice(0, 8);
  const top = state.top.slice(0, 3);
  const marks = showsPlatformMarks([
    ...state.channels.map((c) => c.platform),
    ...recent.map((g) => g.platform),
    ...top.map((v) => v.platform),
  ]);

  return (
    <div data-obs className="flex w-full max-w-md flex-col gap-3 p-4 font-sans">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-h3 font-bold text-foreground">
          {"Kontexto"}
        </span>
        <span className="text-small text-muted-foreground">
          {`Runde ${state.round}`}
        </span>
      </div>

      {state.category && (
        <span className="text-small text-muted-foreground">
          {"Kategorie: "}
          <span className="font-semibold text-foreground">{state.category.name}</span>
        </span>
      )}

      {state.solved && state.solved_by ? (
        <div className="flex flex-col gap-1">
          <RevealWord word={state.recent.find((g) => g.rank === 1)?.word ?? ""} />
          <span className="text-small text-muted-foreground">
            {`Gefunden von ${state.solved_by}`}
          </span>
        </div>
      ) : (
        <span className="text-small text-muted-foreground">
          {state.best_rank === null
            ? "Noch kein Treffer"
            : `Bester Rang: ${state.best_rank}`}
        </span>
      )}

      <ol className="flex list-none flex-col gap-1.5">
        {recent.map((guess) => (
          <li key={`${guess.word}-${guess.rank}`} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-small">
              <span className="min-w-0 truncate text-muted-foreground">
                {guess.nickname}
              </span>
              {marks && guess.platform && <PlatformMark platform={guess.platform} />}
            </div>
            <GuessBar word={guess.word} rank={guess.rank} />
          </li>
        ))}
      </ol>

      {top.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-muted-foreground">
          {top.map((viewer, index) => (
            <span
              key={`${viewer.platform}-${viewer.nickname}-${index}`}
              className="inline-flex items-center gap-1"
            >
              {viewer.nickname}
              {marks && <PlatformMark platform={viewer.platform} className="size-3" />}
              {`: ${viewer.hits}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
