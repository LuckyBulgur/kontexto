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
    <div className="flex flex-col items-center gap-1.5 pb-4">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1">
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
        </div>
      ))}
    </div>
  );
}
