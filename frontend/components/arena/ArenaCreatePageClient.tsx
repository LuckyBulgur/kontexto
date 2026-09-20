"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { createArena } from "@/lib/arena-api";
import { ArenaModeId } from "@/lib/arena-types";
import { getInfiniteGame } from "@/lib/api";
import { ARENA_MODE_ORDER, MULTIPLAYER_MODES, isArenaMode } from "@/lib/multiplayer-modes";
import { cn } from "@/lib/utils";

/** `?modus=blitz` preselects a mode; anything else falls back to the first one. */
function modeFromQuery(): ArenaModeId {
  if (typeof window === "undefined") return ARENA_MODE_ORDER[0];
  const requested = new URLSearchParams(window.location.search).get("modus");
  return requested && isArenaMode(requested) ? requested : ARENA_MODE_ORDER[0];
}

export default function ArenaCreatePageClient() {
  const [mode, setMode] = useState<ArenaModeId>(ARENA_MODE_ORDER[0]);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(modeFromQuery());
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = nickname.trim();
    if (!name || loading) return;

    setLoading(true);
    setError(null);
    try {
      // A private arena draws a random game from the pool, never today's daily,
      // so an invited friend who has not played the daily yet is not spoiled.
      const next = await getInfiniteGame([]);
      const created = await createArena(mode, next.gameNumber, name);
      localStorage.setItem(`kontexto_arena_${created.arena_id}`, created.player_token);
      window.location.href = `/arena/${created.arena_id}/`;
    } catch {
      setError("Die Runde konnte nicht erstellt werden");
      setLoading(false);
    }
  };

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
        <form onSubmit={handleCreate} className="rounded-xl border bg-card p-6 space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">Arena-Runde erstellen</h1>
            <p className="text-sm text-muted-foreground">
              {"Du bekommst einen Link zum Teilen. Die Runde startet, sobald ihr zu zweit seid."}
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Modus
            </legend>
            {ARENA_MODE_ORDER.map((id) => {
              const meta = MULTIPLAYER_MODES[id];
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
                    <span className="block text-sm font-medium">{meta.name}</span>
                    <span className="block text-xs text-muted-foreground">{meta.tagline}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div className="space-y-2">
            <label htmlFor="nickname" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dein Name
            </label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Dein Nickname..."
              maxLength={20}
              autoComplete="off"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading || !nickname.trim()} className="w-full">
            {loading ? "Wird erstellt..." : "Runde erstellen"}
          </Button>
        </form>
      </div>
    </div>
  );
}
