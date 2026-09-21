"use client";
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface GuessInputProps {
  onGuess: (word: string) => void;
  disabled?: boolean;
  error?: string | null;
  placeholder?: string;
}

export default function GuessInput({ onGuess, disabled, error, placeholder = "Wort eingeben..." }: GuessInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Keep keyboard users ready to type, but prevent mobile browsers from
    // scrolling past the server-rendered introduction above the game.
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const word = value.trim();
    if (!word || disabled) return;
    onGuess(word);
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="rounded-xl py-6 pr-24 text-lead sm:pr-40"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            // Hidden below sm: at 375px it sat on top of the placeholder, and a
            // watermark that covers the instruction costs more than it earns.
            className="pointer-events-none hidden select-none text-small font-medium text-muted-foreground sm:inline"
          >
            kontexto.de
          </span>
          <Button
            type="submit"
            disabled={disabled || !value.trim()}
            size="sm"
          >
            Enter
          </Button>
        </div>
      </div>
      {error && <p className="mt-1 text-small text-destructive">{error}</p>}
    </form>
  );
}
