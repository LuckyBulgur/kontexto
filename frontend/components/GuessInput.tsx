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
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="pr-40 py-6 text-lg rounded-xl"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="select-none pointer-events-none text-sm font-medium tracking-wide text-muted-foreground"
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
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </form>
  );
}
