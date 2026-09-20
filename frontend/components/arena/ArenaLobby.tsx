"use client";

import { Button } from "@/components/ui/button";
import ShareInviteBar from "@/components/ShareInviteBar";
import { ArenaState } from "@/lib/arena-types";
import { MULTIPLAYER_MODES } from "@/lib/multiplayer-modes";

interface ArenaLobbyProps {
  state: ArenaState;
  currentNickname: string | null;
  onStart: () => void;
  starting: boolean;
  error: string | null;
  onCopyLink: () => void;
}

/**
 * The waiting room. Any player may press start, not just the creator: whoever
 * opened the room is often the one who stepped away, and a lobby that only they
 * can release is a lobby that never starts.
 */
export default function ArenaLobby({
  state,
  currentNickname,
  onStart,
  starting,
  error,
  onCopyLink,
}: ArenaLobbyProps) {
  const meta = MULTIPLAYER_MODES[state.mode];
  const enough = state.players.length >= 2;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="text-lg font-bold">{meta.name}</h2>
        <p className="text-sm text-muted-foreground">{meta.tagline}</p>
        <ul className="space-y-1.5 list-disc pl-5 text-sm text-muted-foreground">
          {meta.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Im Raum ({state.players.length})
        </h3>
        <ul className="space-y-1">
          {state.players.map((player) => (
            <li key={player.nickname} className="text-sm">
              {player.nickname}
              {player.nickname === currentNickname && (
                <span className="ml-1 text-xs text-muted-foreground">(du)</span>
              )}
            </li>
          ))}
        </ul>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={onStart} disabled={!enough || starting} className="w-full">
          {starting ? "Startet..." : enough ? "Runde starten" : "Warte auf Mitspieler"}
        </Button>
        {!enough && (
          <p className="text-xs text-muted-foreground">
            Teile den Link, dann kann es losgehen.
          </p>
        )}
      </div>

      <ShareInviteBar
        onCopy={onCopyLink}
        title="Noch jemand fehlt?"
        description="Schick den Link, dann steht ihr gemeinsam am Start."
      />
    </div>
  );
}
