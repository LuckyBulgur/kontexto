"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createKoop } from "@/lib/koop-api";
import { ArrowLeft } from "lucide-react";
import { Panel } from "@/components/design";
import { Wordmark } from "@/components/design";

export default function KoopCreatePageClient() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [gameMode, setGameMode] = useState<"today" | "random">("today");
  const [tipsAllowed, setTipsAllowed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // Only the kind of game, never its number: the server picks, because
      // the number is enough to look the answer up. See lib/types RoomRevealResult.
      const result = await createKoop(gameMode, nickname.trim(), tipsAllowed);
      localStorage.setItem(`kontexto_koop_${result.koop_id}`, result.player_token);
      router.push(`/koop/${result.koop_id}/`);
    } catch {
      setError("Fehler beim Erstellen des Koops");
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
          <Wordmark />
        </div>
        <h1 className="mt-2 text-h1">Koop erstellen</h1>
      </header>

      <main className="flex-1 px-4 py-6 flex flex-col gap-5">
        <Panel className="gap-5">
          <p className="text-small text-muted-foreground">
            Sucht gemeinsam dasselbe geheime Wort. Teile den Link, jeder Tipp
            ist sofort für alle sichtbar, und ihr gewinnt als Team.
          </p>

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

          {error && <p className="text-small text-destructive">{error}</p>}

          <Button
            onClick={handleCreate}
            disabled={loading || !nickname.trim()}
            className="w-full"
          >
            {loading ? "Erstelle..." : "Koop erstellen"}
          </Button>
        </Panel>
      </main>
    </div>
  );
}
