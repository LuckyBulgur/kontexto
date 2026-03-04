"use client";
import { useState, useRef, useEffect } from "react";

interface GuessInputProps { onGuess: (word: string) => void; disabled?: boolean; error?: string | null; }

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
        <input ref={inputRef} type="text" value={value} onChange={(e) => setValue(e.target.value)}
          placeholder="Wort eingeben..." disabled={disabled} autoComplete="off" autoCapitalize="off" spellCheck={false}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 text-lg transition-colors" />
        <button type="submit" disabled={disabled || !value.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium text-sm transition-colors">
          Enter
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-500 dark:text-red-400">{error}</p>}
    </form>
  );
}
