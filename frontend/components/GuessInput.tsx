"use client";
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface GuessInputProps {
  onGuess: (word: string) => void;
  disabled?: boolean;
  error?: string | null;
}

export default function GuessInput({ onGuess, disabled, error }: GuessInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

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
          placeholder="Wort eingeben..."
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="pr-20 py-6 text-lg rounded-xl"
        />
        <Button
          type="submit"
          disabled={disabled || !value.trim()}
          size="sm"
          className="absolute right-2 top-1/2 -translate-y-1/2"
        >
          Enter
        </Button>
      </div>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </form>
  );
}
