"use client";

type KeyColor = "green" | "yellow" | "gray" | "default";

const KEY_COLOR_MAP: Record<KeyColor, string> = {
  green: "border-tile-correct bg-tile-correct text-tile-foreground",
  yellow: "border-tile-present bg-tile-present text-tile-foreground",
  gray: "border-tile-absent bg-tile-absent text-tile-foreground",
  default: "border-border bg-secondary text-secondary-foreground",
};

interface KeyProps {
  label: string;
  value: string;
  color?: KeyColor;
  wide?: boolean;
  onClick: (value: string) => void;
}

export default function Key({ label, value, color = "default", wide = false, onClick }: KeyProps) {
  return (
    <button
      type="button"
      className={`${KEY_COLOR_MAP[color]} ${wide ? "flex-[1.5] text-micro sm:text-small" : "flex-1 text-body"} min-w-0 h-[58px] sm:h-[64px] rounded-md font-bold uppercase flex items-center justify-center border cursor-pointer active:scale-95 transition-transform select-none`}
      onClick={() => onClick(value)}
    >
      {label}
    </button>
  );
}
