"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWordleGame, createWordleDuel } from "@/lib/wordle-api";
import { saveDuelToken, saveDuelNickname } from "@/lib/wordle-storage";
import WordleHeader from "@/components/wordle/WordleHeader";

export default function WordleDuelCreatePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [gameNumber, setGameNumber] = useState<number | null>(null);
  const [gameMode, setGameMode] = useState<"today" | "random">("today");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getWordleGame().then(({ game_number }) => setGameNumber(game_number));
  }, []);

  const handleCreate = async () => {
    if (!nickname.trim() || gameNumber === null) return;
    setCreating(true);
    try {
      const gn = gameMode === "today" ? gameNumber : Math.floor(Math.random() * 5000) + 1;
      const { duel_id, player_token } = await createWordleDuel(nickname.trim(), gn);
      saveDuelToken(duel_id, player_token);
      saveDuelNickname(duel_id, nickname.trim());
      const url = `${window.location.origin}/wordle/duel/${duel_id}/`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Duell erstellt – Link kopiert!");
      } catch {
        // Clipboard ohne gültige Nutzergeste blockiert (z.B. Safari nach dem
        // await). Manueller Copy-Button im Duell-Header bleibt als Fallback.
        toast.success("Duell erstellt!");
      }
      router.push(`/wordle/duel/${duel_id}/`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <WordleHeader backHref="/wordle" subtitle="Duell erstellen" hideDuelCreate />

      <div className="max-w-sm mx-auto p-6 space-y-6 mt-8">
        <h2 className="text-xl font-bold text-center">Wördle Duell erstellen</h2>

        <div className="space-y-2">
          <Label htmlFor="nickname">Dein Nickname</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="z.B. Max"
            maxLength={20}
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
          <p className="text-sm text-muted-foreground">
            {gameMode === "today"
              ? `Spiel #${gameNumber ?? "..."} (heutiges Wördle)`
              : "Zufälliges Wördle – für beide Spieler gleich"}
          </p>
        </div>

        <Button
          onClick={handleCreate}
          disabled={!nickname.trim() || creating}
          className="w-full"
        >
          {creating ? "Erstellen..." : "Duell erstellen"}
        </Button>
      </div>
    </div>
  );
}
