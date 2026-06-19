import { useEffect } from "react";

/** True, wenn das Ziel ein eigenes Texteingabe-Element ist (input/textarea/select/
 *  contentEditable) und daher rohe Tastenereignisse behalten muss — z. B. das
 *  Nickname-Feld der Duell-Beitreten-Form, das sonst ins Grid gespiegelt würde.
 *  Duck-typed (kein `instanceof`), damit ohne DOM-Globals testbar. */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true
  );
}

interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}

/** Mappt ein physisches Tastenereignis auf eine Wördle-Aktion ("ENTER"/"BACKSPACE"/
 *  Buchstabe) oder null, wenn es ignoriert werden soll (Modifier-Kombi, Fokus in einem
 *  Textfeld, Nicht-Buchstaben-Taste). `KeyboardEvent` erfüllt `KeyEventLike` strukturell. */
export function mapKeyboardEvent(e: KeyEventLike): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (isTextEntryTarget(e.target)) return null;
  if (e.key === "Enter") return "ENTER";
  if (e.key === "Backspace") return "BACKSPACE";
  if (/^[a-zA-Z]$/.test(e.key)) return e.key;
  return null;
}

/** Registriert den physischen Keyboard-Listener für das Wördle-Grid. Ignoriert
 *  Eingaben, solange ein Texteingabefeld fokussiert ist (siehe `isTextEntryTarget`),
 *  und lässt sich über `enabled` ganz abschalten (z. B. während der Duell-Beitreten-
 *  Ansicht). */
export function useWordlePhysicalKeyboard(onKey: (key: string) => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const action = mapKeyboardEvent(e);
      if (action !== null) onKey(action);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onKey, enabled]);
}
