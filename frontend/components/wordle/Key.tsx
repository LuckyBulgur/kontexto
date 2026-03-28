"use client";

type KeyColor = "green" | "yellow" | "gray" | "default";

const KEY_COLOR_MAP: Record<KeyColor, string> = {
  green: "bg-green-500 text-white border-green-500 dark:bg-[#538d4e] dark:border-[#538d4e]",
  yellow: "bg-yellow-500 text-white border-yellow-500 dark:text-white dark:border-[#b59f3b] dark:bg-[#b59f3b]",
  gray: "bg-zinc-400 text-white border-zinc-400 dark:bg-zinc-700 dark:border-zinc-700 dark:text-white",
  default: "bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-500 dark:text-white dark:border-zinc-500",
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
      className={`${KEY_COLOR_MAP[color]} ${wide ? "px-4 sm:px-6 text-sm" : "w-[36px] sm:w-[46px]"} h-[58px] sm:h-[64px] rounded font-bold uppercase text-base flex items-center justify-center border cursor-pointer active:scale-95 transition-transform select-none`}
      onClick={() => onClick(value)}
    >
      {label}
    </button>
  );
}
