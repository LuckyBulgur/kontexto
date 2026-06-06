"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface JoinFormProps {
  onJoin: (nickname: string) => void;
  loading?: boolean;
  error?: string | null;
}

export default function JoinForm({ onJoin, loading, error }: JoinFormProps) {
  const [nickname, setNickname] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim()) onJoin(nickname.trim());
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-bold text-center">Wördle Duell beitreten</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Dein Nickname..."
            maxLength={20}
            autoComplete="off"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={loading || !nickname.trim()}
            className="w-full"
          >
            {loading ? "Beitreten..." : "Beitreten"}
          </Button>
        </form>
      </div>
    </div>
  );
}
