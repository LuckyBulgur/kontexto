"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/design";

interface JoinDialogProps {
  onJoin: (nickname: string) => void;
  loading?: boolean;
  error?: string | null;
}

export default function JoinDialog({ onJoin, loading, error }: JoinDialogProps) {
  const [nickname, setNickname] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim()) onJoin(nickname.trim());
  };

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col items-center justify-center px-4">
      <Panel className="w-full gap-4 p-6">
        <h2 className="text-h3 font-bold text-center">Duell beitreten</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Dein Nickname..."
            maxLength={20}
            autoComplete="off"
            autoFocus
          />
          {error && <p className="text-small text-destructive">{error}</p>}
          <Button
            type="submit"
            disabled={loading || !nickname.trim()}
            className="w-full"
          >
            {loading ? "Beitreten..." : "Beitreten"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
