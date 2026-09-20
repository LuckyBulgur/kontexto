"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ShareInviteBar from "@/components/ShareInviteBar";
import { ARENA_MAX_PLAYERS, ARENA_MIN_PLAYERS } from "@/lib/arena-rules";
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
 * The waiting room.
 *
 * Any player may press start, not just the creator: whoever opened the room is
 * often the one who stepped away, and a lobby only they can release is a lobby
 * that never starts. That is the whole difference to the random queue, where
 * nobody presses anything and the server pairs by itself, so the lobby says so
 * rather than leaving the group to work it out.
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
  const enough = state.players.length >= ARENA_MIN_PLAYERS;
  const full = state.players.length >= ARENA_MAX_PLAYERS;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{meta.name}</CardTitle>
          <CardDescription>{meta.tagline}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {meta.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {`Im Raum: ${state.players.length} von ${ARENA_MAX_PLAYERS}`}
          </CardTitle>
          <CardDescription>
            {enough
              ? "Ihr könnt jederzeit starten. Wer zuerst drückt, startet für alle."
              : `Ab ${ARENA_MIN_PLAYERS} Spielern könnt ihr starten.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
          {full && (
            <p className="text-xs text-muted-foreground">
              {"Der Raum ist voll, mehr passen nicht rein."}
            </p>
          )}
        </CardContent>
      </Card>

      <ShareInviteBar
        onCopy={onCopyLink}
        title="Noch jemand fehlt?"
        description="Schick den Link, dann steht ihr gemeinsam am Start."
      />
    </div>
  );
}
