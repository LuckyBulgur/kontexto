"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Header from "@/components/Header";
import { createArena } from "@/lib/arena-api";
import { ArenaModeId } from "@/lib/arena-types";
import { getInfiniteGame } from "@/lib/api";
import { ARENA_MODE_ORDER, MULTIPLAYER_MODES, isArenaMode } from "@/lib/multiplayer-modes";
import { PARTY_RULES, partySizeLabel } from "@/lib/matchmaking-rules";
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
        <form onSubmit={handleCreate}>
          <Card>
            <CardHeader>
              <CardTitle>Arena-Runde erstellen</CardTitle>
              <CardDescription>
                {"Du bekommst einen Link zum Teilen. Sobald ihr zu zweit seid, kann jeder von euch die Runde starten."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-micro font-semibold text-muted-foreground">
                  Modus
                </Label>
                <RadioGroup
                  value={mode}
                  onValueChange={(value) => setMode(value as ArenaModeId)}
                  className="gap-2"
                >
                  {ARENA_MODE_ORDER.map((id) => {
                    const meta = MULTIPLAYER_MODES[id];
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
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-display text-lead font-bold">{meta.name}</span>
                          <span className="text-small text-muted-foreground">{meta.tagline}</span>
                          <span className="text-micro text-muted-foreground/80">
                            {partySizeLabel(PARTY_RULES[id])}
                          </span>
                        </span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nickname">Dein Name</Label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Dein Nickname..."
                  maxLength={20}
                  autoComplete="off"
                />
              </div>

              {error && <p className="text-small text-destructive">{error}</p>}

              <Button type="submit" disabled={loading || !nickname.trim()} className="w-full">
                {loading ? "Wird erstellt..." : "Runde erstellen"}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
