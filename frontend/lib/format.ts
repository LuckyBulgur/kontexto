// Shared, locale-aware formatting helpers (de-DE). Used by the admin dashboard
// and the player statistics views so numbers, percentages, dates and times read
// the same friendly way everywhere.

const numberFormat = new Intl.NumberFormat("de-DE");
const decimalFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** 1234 -> "1.234" */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "–";
  return numberFormat.format(value);
}

/** 4.7 -> "4,7"; integers stay integer. */
export function formatDecimal(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "–";
  return decimalFormat.format(value);
}

/** 0.732 -> "73 %" (ratio in 0..1). */
export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio == null || Number.isNaN(ratio)) return "–";
  return `${(ratio * 100).toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} %`;
}

/** Hour bucket label, e.g. 14 -> "14 Uhr". */
export function formatHour(hour: number | string): string {
  return `${hour} Uhr`;
}

/** ISO date "2026-06-06" -> "06.06." (compact axis label). */
export function shortDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.`;
  return iso;
}

/** ISO date "2026-06-06" -> "06.06.2026". */
export function fullDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return iso;
}

/** Percent change of `current` vs `previous`, or null when there is no baseline. */
export function trend(current: number, previous: number): { delta: number; positive: boolean } | null {
  if (!previous) return null;
  const delta = (current - previous) / previous;
  if (!Number.isFinite(delta) || delta === 0) return null;
  return { delta, positive: delta > 0 };
}

export const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;
