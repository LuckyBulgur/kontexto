"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createDuel } from "@/lib/duel-api";
import { getGameInfo } from "@/lib/api";

export default function DuelCreatePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [gameNumber, setGameNumber] = useState<number>(0);
  const [tipsAllowed, setTipsAllowed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [todayGame, setTodayGame] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGameInfo().then((info) => {
      setGameNumber(info.gameNumber);
      setTodayGame(info.gameNumber);
    });
  }, []);

  const handleCreate = async () => {
    if (!nickname.trim() || !gameNumber) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createDuel(gameNumber, nickname.trim(), tipsAllowed);
      localStorage.setItem(
        `kontexto_duel_${result.duel_id}`,
        result.player_token
      );
      router.push(`/duel/${result.duel_id}/`);
    } catch {
      setError("Fehler beim Erstellen des Duells");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      <header className="flex flex-col items-center px-4 pt-5 pb-1">
        <h1 className="text-[24px] font-bold tracking-wider">KONTEXTO</h1>
        <p className="text-sm text-muted-foreground mt-1">Duell erstellen</p>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col gap-5">
        <div className="rounded-xl border bg-card p-5 space-y-5">
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

          <div className="space-y-2">
            <Label htmlFor="game">Spiel-Nummer</Label>
            <Input
              id="game"
              type="number"
              value={gameNumber || ""}
              onChange={(e) => setGameNumber(Number(e.target.value))}
              min={1}
              max={todayGame}
            />
            <p className="text-xs text-muted-foreground">
              Heutiges Spiel: #{todayGame}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="tips">Tipps erlauben</Label>
            <Switch
              id="tips"
              checked={tipsAllowed}
              onCheckedChange={setTipsAllowed}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={handleCreate}
            disabled={loading || !nickname.trim() || !gameNumber}
            className="w-full"
          >
            {loading ? "Erstelle..." : "Duell erstellen"}
          </Button>
        </div>
      </main>
    </div>
  );
}
