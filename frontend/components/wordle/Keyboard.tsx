"use client";

import Key from "./Key";

type KeyColor = "green" | "yellow" | "gray" | "default";

const ROWS = [
  ["Q", "W", "E", "R", "T", "Z", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Y", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
];

interface KeyboardProps {
  letterStates: Map<string, KeyColor>;
  onKey: (key: string) => void;
}

export default function Keyboard({ letterStates, onKey }: KeyboardProps) {
  return (
    // Fluide Tastatur: füllt die Breite (gedeckelt auf 500px) und passt sich
    // schmalen Viewports an, statt mit festen Pixelbreiten überzulaufen. Jede
    // Reihe summiert sich auf 10 Flex-Einheiten (Buchstabe = 1, breite Taste =
    // 1.5, halbe Abstandshalter = 0.5), sodass die Spalten reihenübergreifend
    // bündig bleiben.
    <div className="mx-auto flex w-full max-w-[500px] flex-col gap-1.5 px-2 pb-4">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {ri === 1 && <div className="flex-[0.5]" aria-hidden />}
          {row.map((key) => {
            if (key === "ENTER") {
              return <Key key={key} label="Enter" value="ENTER" wide onClick={onKey} />;
            }
            if (key === "BACKSPACE") {
              return <Key key={key} label="&#9003;" value="BACKSPACE" wide onClick={onKey} />;
            }
            return (
              <Key
                key={key}
                label={key}
                value={key}
                color={letterStates.get(key.toLowerCase()) || "default"}
                onClick={onKey}
              />
            );
          })}
          {ri === 1 && <div className="flex-[0.5]" aria-hidden />}
        </div>
      ))}
    </div>
  );
}
