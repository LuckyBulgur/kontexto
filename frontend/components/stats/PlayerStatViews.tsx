"use client";

// Lightweight, dependency-free visuals shared by the Kontexto and Wördle player
// statistics dialogs. Deliberately NOT built on recharts so the game route
// bundles stay small (recharts is reserved for the admin dashboard).

import { WEEKDAY_LABELS } from "@/lib/format";

export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-3 text-center">
      <div className="text-2xl font-bold tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[11px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

export interface DistributionRow {
  label: string;
  value: number;
}

export function DistributionBars({
  rows,
  highlightLabel,
}: {
  rows: DistributionRow[];
  highlightLabel?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-1">
      {rows.map((r) => {
        const highlighted = r.label === highlightLabel;
        return (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{r.label}</span>
            <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
              <div
                className={`flex h-full items-center justify-end rounded px-1.5 text-[10px] font-bold text-white ${
                  highlighted ? "bg-green-600" : "bg-zinc-500 dark:bg-zinc-600"
                }`}
                style={{ width: `${r.value > 0 ? Math.max(12, (r.value / max) * 100) : 0}%` }}
              >
                {r.value > 0 ? r.value : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const DAY_MS = 86_400_000;

function isoUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// GitHub-style played-days grid. `dates` are ISO "YYYY-MM-DD" strings (UTC), the
// same form recordGamePlayed stores, so membership lines up exactly.
export function CalendarHeatmap({ dates, weeks = 18 }: { dates: string[]; weeks?: number }) {
  const played = new Set(dates);
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const todayIso = isoUTC(todayUTC);
  const mondayIndex = (new Date(todayUTC).getUTCDay() + 6) % 7; // 0 = Monday
  const startMonday = todayUTC - ((weeks - 1) * 7 + mondayIndex) * DAY_MS;

  const columns = Array.from({ length: weeks }, (_, col) =>
    Array.from({ length: 7 }, (_, row) => startMonday + (col * 7 + row) * DAY_MS),
  );

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]">
        <div className="mr-1 flex flex-col gap-[3px] pt-[2px] text-[9px] text-muted-foreground">
          {WEEKDAY_LABELS.map((d, i) => (
            <span key={d} className="h-3 leading-3">{i % 2 === 0 ? d : ""}</span>
          ))}
        </div>
        {columns.map((week, ci) => (
          <div key={ci} className="flex flex-col gap-[3px]">
            {week.map((ms) => {
              const iso = isoUTC(ms);
              const future = ms > todayUTC;
              const active = played.has(iso);
              const isToday = iso === todayIso;
              return (
                <div
                  key={ms}
                  title={future ? "" : `${iso}${active ? " · gespielt" : ""}`}
                  className={`h-3 w-3 rounded-[2px] ${isToday ? "ring-1 ring-foreground/50" : ""}`}
                  style={{
                    backgroundColor: future
                      ? "transparent"
                      : active
                        ? "var(--color-chart-2)"
                        : "var(--color-muted)",
                    opacity: future ? 0 : active ? 1 : 0.6,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
