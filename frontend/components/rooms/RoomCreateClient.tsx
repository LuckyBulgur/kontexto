"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Panel, Wordmark } from "@/components/design";
import { createArena } from "@/lib/arena-api";
import { ArenaModeId } from "@/lib/arena-types";
import { createDuel } from "@/lib/duel-api";
import { createKoop } from "@/lib/koop-api";
import { PARTY_RULES, partySizeLabel } from "@/lib/matchmaking-rules";
import { QueueModeId } from "@/lib/matchmaking-types";
import {
  KONTEXTO_MULTIPLAYER_ORDER,
  MULTIPLAYER_MODES,
  isQueueMode,
} from "@/lib/multiplayer-modes";
import { cn } from "@/lib/utils";

/**
 * One form for every private Kontexto room.
 *
 * There used to be three, one per route, and each one knew only its own mode.
 * A player who reached the duel form from the menu never learned that koop and
 * the three arenas exist, because nothing on that page said so. The modes now
 * stand next to each other, with the one the player asked for preselected.
 *
 * This is the invite path and only the invite path: the room is private, and
 * whoever wants strangers takes the queue, which is a different screen with a
 * different promise. Mixing the two here would turn one button into a question.
 */

interface RoomCreateClientProps {
  /** The mode the route asked for. `?modus=` may override it, which is how the
   *  three arena modes share one route. */
  preselect: QueueModeId;
}

/** Rooms with a puzzle the creator may choose, and with tips to allow. */
function isPairMode(mode: QueueModeId): mode is "duel" | "koop" {
  return mode === "duel" || mode === "koop";
}

export default function RoomCreateClient({ preselect }: RoomCreateClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<QueueModeId>(preselect);
  const [nickname, setNickname] = useState("");
  const [gameSource, setGameSource] = useState<"today" | "random">("today");
  const [tipsAllowed, setTipsAllowed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The Wordle duel is created on the Wordle side, so a link that asked for it
  // here falls back rather than offering a round of the other game.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const requested = new URLSearchParams(window.location.search).get("modus");
    if (requested && isQueueMode(requested) && KONTEXTO_MULTIPLAYER_ORDER.includes(requested)) {
      setMode(requested);
    }
  }, []);

  const meta = MULTIPLAYER_MODES[mode];

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = nickname.trim();
    if (!name || loading) return;

    setLoading(true);
    setError(null);
    try {
      // Only the kind of game, never its number: the server picks, because the
      // number is enough to look the answer up. See lib/types RoomRevealResult.
      if (mode === "duel") {
        const created = await createDuel(gameSource, name, tipsAllowed);
        localStorage.setItem(`kontexto_duel_${created.duel_id}`, created.player_token);
        router.push(`/duel/${created.duel_id}/`);
        return;
      }
      if (mode === "koop") {
        const created = await createKoop(gameSource, name, tipsAllowed);
        localStorage.setItem(`kontexto_koop_${created.koop_id}`, created.player_token);
        router.push(`/koop/${created.koop_id}/`);
        return;
      }
      // An arena always draws a random game, so an invited friend who has not
      // played today's daily yet is not spoiled by joining.
      const created = await createArena(mode as ArenaModeId, "random", name);
      localStorage.setItem(`kontexto_arena_${created.arena_id}`, created.player_token);
      // A full load, not a client push: /arena/<id>/ is not a route the router
      // knows, it is the one /arena/ page that reads the id from the path, and
      // only the server side of the export resolves that.
      window.location.href = `/arena/${created.arena_id}/`;
    } catch {
      setError("Die Runde konnte nicht erstellt werden");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      <header className="relative flex flex-col items-center px-4 pt-5 pb-1">
        <div className="relative flex items-center justify-center w-full">
          <a href="/" className="absolute left-4">
            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Zurück">
              <ArrowLeft className="h-6! w-6!" />
            </Button>
          </a>
          <Wordmark />
        </div>
        <h1 className="mt-2 text-h1">{meta.name} erstellen</h1>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col gap-5">
        <form onSubmit={handleCreate}>
          <Panel className="gap-5">
            <p className="text-small text-muted-foreground">
              {"Du bekommst einen Einladungslink. Mitspielen kann nur, wer ihn von dir hat."}
            </p>

            <div className="space-y-2">
              <Label className="text-micro font-semibold text-muted-foreground">Modus</Label>
              <RadioGroup
                value={mode}
                onValueChange={(value) => setMode(value as QueueModeId)}
                className="gap-2"
              >
                {KONTEXTO_MULTIPLAYER_ORDER.map((id) => {
                  const entry = MULTIPLAYER_MODES[id];
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
                        <span className="font-display text-lead font-bold">{entry.name}</span>
                        <span className="text-small text-muted-foreground">{entry.hook}</span>
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
              <Label htmlFor="nickname">Dein Nickname</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nickname eingeben..."
                maxLength={20}
                autoComplete="off"
              />
            </div>

            {isPairMode(mode) ? (
              <>
                <div className="space-y-2">
                  <Label>Spiel</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={gameSource === "today" ? "default" : "outline"}
                      onClick={() => setGameSource("today")}
                      className="w-full"
                    >
                      Heutiges Spiel
                    </Button>
                    <Button
                      type="button"
                      variant={gameSource === "random" ? "default" : "outline"}
                      onClick={() => setGameSource("random")}
                      className="w-full"
                    >
                      Zufälliges Spiel
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="tips">Tipps erlauben</Label>
                  <Switch id="tips" checked={tipsAllowed} onCheckedChange={setTipsAllowed} />
                </div>
              </>
            ) : (
              <p className="text-small text-muted-foreground">
                {"Eine Arena-Runde zieht immer ein zufälliges Spiel, damit das heutige Rätsel niemandem verraten wird."}
              </p>
            )}

            {error && <p className="text-small text-destructive">{error}</p>}

            <Button type="submit" disabled={loading || !nickname.trim()} className="w-full">
              {loading ? "Wird erstellt..." : `${meta.name} erstellen`}
            </Button>
          </Panel>
        </form>
      </main>
    </div>
  );
}
