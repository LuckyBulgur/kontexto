"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createDuel } from "@/lib/duel-api";
import { getGameInfo } from "@/lib/api";
import { ArrowLeft } from "lucide-react";

export default function DuelCreatePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [gameMode, setGameMode] = useState<"today" | "random">("today");
  const [tipsAllowed, setTipsAllowed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [todayGame, setTodayGame] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGameInfo().then((info) => {
      setTodayGame(info.gameNumber);
    });
  }, []);

  const handleCreate = async () => {
    if (!nickname.trim() || !todayGame) return;
    setLoading(true);
    setError(null);
    try {
      const gameNumber =
        gameMode === "today"
          ? todayGame
          : Math.floor(Math.random() * 5000) + 1;
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
      <header className="relative flex flex-col items-center px-4 pt-5 pb-1">
        <div className="relative flex items-center justify-center w-full">
          <a href="/" className="absolute left-4">
            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Zurück">
              <ArrowLeft className="h-6! w-6!" />
            </Button>
          </a>
          <h1 className="text-[24px] font-bold tracking-wider">KONTEXTO</h1>
        </div>
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
            <Label>Spiel</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={gameMode === "today" ? "default" : "outline"}
                onClick={() => setGameMode("today")}
                className="w-full"
              >
                Heutiges Spiel
              </Button>
              <Button
                type="button"
                variant={gameMode === "random" ? "default" : "outline"}
                onClick={() => setGameMode("random")}
                className="w-full"
              >
                Zufälliges Spiel
              </Button>
            </div>
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
            disabled={loading || !nickname.trim() || !todayGame}
            className="w-full"
          >
            {loading ? "Erstelle..." : "Duell erstellen"}
          </Button>
        </div>
      </main>
    </div>
  );
}
