"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWordleGame, createWordleDuel } from "@/lib/wordle-api";
import { saveDuelToken, saveDuelNickname } from "@/lib/wordle-storage";
import Link from "next/link";

export default function WordleDuelCreatePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [gameNumber, setGameNumber] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getWordleGame().then(({ game_number }) => setGameNumber(game_number));
  }, []);

  const handleCreate = async () => {
    if (!nickname.trim() || gameNumber === null) return;
    setCreating(true);
    try {
      const { duel_id, player_token } = await createWordleDuel(nickname.trim(), gameNumber);
      saveDuelToken(duel_id, player_token);
      saveDuelNickname(duel_id, nickname.trim());
      router.push(`/wordle/duel/${duel_id}/`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      <header className="flex items-center justify-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-1 text-lg font-bold tracking-wider">
          <Link href="/wordle" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">WÖRDLE</Link>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <span>DUELL</span>
        </div>
      </header>

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

        <div className="text-sm text-zinc-500">
          Spiel #{gameNumber ?? "..."} (heutiges Wördle)
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
