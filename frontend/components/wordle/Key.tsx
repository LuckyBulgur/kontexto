"use client";

type KeyColor = "green" | "yellow" | "gray" | "default";

const KEY_COLOR_MAP: Record<KeyColor, string> = {
  green: "bg-green-600 text-white border-green-600",
  yellow: "bg-yellow-500 text-white border-yellow-500",
  gray: "bg-zinc-500 text-white border-zinc-500 dark:bg-zinc-600",
  default: "bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-600",
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
      className={`${KEY_COLOR_MAP[color]} ${wide ? "px-3 sm:px-4 text-xs" : "w-[32px] sm:w-[40px]"} h-[52px] sm:h-[58px] rounded font-bold uppercase text-sm flex items-center justify-center border cursor-pointer active:scale-95 transition-transform select-none`}
      onClick={() => onClick(value)}
    >
      {label}
    </button>
  );
}
