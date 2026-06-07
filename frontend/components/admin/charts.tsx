"use client";

// Themed chart kit for the admin dashboard, built on recharts. All colours are
// driven by the app's CSS custom properties (--color-chart-1..5, --color-*) so
// charts follow the light/dark theme automatically. recharts is client-only and
// lives only in the /admin/stats route bundle.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatNumber, shortDate, WEEKDAY_LABELS } from "@/lib/format";
import type { TimelinePoint } from "@/lib/types";

export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const AXIS_TICK = { fill: "var(--color-muted-foreground)", fontSize: 11 } as const;

// --- Layout primitives -------------------------------------------------------

export function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

export function Panel({
  title,
  hint,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border bg-card p-4 shadow-sm sm:p-5 ${className}`}>
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

// --- KPI card with trend + sparkline -----------------------------------------

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  spark,
  accent = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  trend?: { delta: number; positive: boolean } | null;
  spark?: TimelinePoint[];
  accent?: number;
}) {
  const color = CHART_COLORS[accent % CHART_COLORS.length];
  return (
    <div className="relative flex flex-col gap-2 overflow-hidden rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: color, color: "var(--color-card)" }}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold tabular-nums tracking-tight">{value}</span>
        {trend && (
          <span
            className={`mb-1 inline-flex items-center gap-0.5 text-xs font-medium ${
              trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(Math.round(trend.delta * 100))}%
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      {spark && spark.length > 1 && (
        <div className="mt-1 h-8 w-full">
          <Sparkline data={spark} color={color} />
        </div>
      )}
    </div>
  );
}

function Sparkline({ data, color }: { data: TimelinePoint[]; color: string }) {
  const gradId = useId();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// --- Tooltip -----------------------------------------------------------------

interface TooltipPayloadItem {
  value?: number | string;
  name?: string;
  color?: string;
  payload?: Record<string, unknown>;
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v) => formatNumber(Number(v)),
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  valueFormatter?: (v: number | string) => string;
  labelFormatter?: (l: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label != null && (
        <div className="mb-1 font-medium text-popover-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-muted-foreground">
          {p.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />}
          {p.name && <span>{p.name}:</span>}
          <span className="font-medium text-popover-foreground">
            {p.value != null ? valueFormatter(p.value) : "–"}
          </span>
        </div>
      ))}
    </div>
  );
}

// --- Area trend (timelines) --------------------------------------------------

export function AreaTrend({
  data,
  accent = 1,
  height = 200,
  valueFormatter,
  labelFormatter = shortDate,
}: {
  data: TimelinePoint[];
  accent?: number;
  height?: number;
  valueFormatter?: (v: number | string) => string;
  labelFormatter?: (l: string) => string;
}) {
  const gradId = useId();
  const color = CHART_COLORS[accent % CHART_COLORS.length];
  if (data.length === 0) return <Empty />;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tickFormatter={(l) => labelFormatter(String(l))} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip
            content={
              <ChartTooltip valueFormatter={valueFormatter} labelFormatter={(l) => labelFormatter(String(l))} />
            }
            cursor={{ stroke: "var(--color-border)" }}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradId})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Histogram (ordered buckets) ---------------------------------------------

export function Histogram({
  data,
  order,
  accent = 1,
  height = 200,
}: {
  data: Record<string, number>;
  order: string[];
  accent?: number;
  height?: number;
}) {
  const color = CHART_COLORS[accent % CHART_COLORS.length];
  const rows = order.filter((k) => k in data).map((k) => ({ bucket: k, value: data[k] }));
  // Append any buckets that arrived outside the known order (forward-compatible).
  for (const k of Object.keys(data)) {
    if (!order.includes(k)) rows.push({ bucket: k, value: data[k] });
  }
  if (rows.length === 0) return <Empty />;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="bucket" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.4 }} />
          <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Donut (categorical share) -----------------------------------------------

export function DonutChart({
  data,
  height = 220,
  labelMap,
}: {
  data: Record<string, number>;
  height?: number;
  labelMap?: Record<string, string>;
}) {
  const entries = Object.entries(data)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name: labelMap?.[name] ?? name, value }));
  const total = entries.reduce((s, e) => s + e.value, 0);
  if (entries.length === 0) return <Empty />;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div style={{ height, width: height }} className="shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={entries} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
              {entries.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  valueFormatter={(v) => `${formatNumber(Number(v))} (${Math.round((Number(v) / total) * 100)}%)`}
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-1.5 self-center">
        {entries.map((e, i) => (
          <li key={e.name} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="flex-1 truncate text-foreground">{e.name}</span>
            <span className="tabular-nums text-muted-foreground">{formatNumber(e.value)}</span>
            <span className="w-10 text-right tabular-nums text-xs text-muted-foreground">
              {Math.round((e.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Ranking bar list (labels + values, no axis) -----------------------------

export function BarRanking({
  data,
  accent = 1,
  emptyLabel = "Keine Daten",
  labelMap,
  max: maxItems = 0,
}: {
  data: Record<string, number> | { label: string; value: number }[];
  accent?: number;
  emptyLabel?: string;
  labelMap?: Record<string, string>;
  max?: number;
}) {
  const color = CHART_COLORS[accent % CHART_COLORS.length];
  let entries = Array.isArray(data)
    ? data.map((d) => [d.label, d.value] as [string, number])
    : Object.entries(data);
  entries = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (maxItems > 0) entries = entries.slice(0, maxItems);
  if (entries.length === 0) return <Empty label={emptyLabel} />;
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="space-y-1.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 truncate" title={labelMap?.[key] ?? key}>
            {labelMap?.[key] ?? key}
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
            <div
              className="flex h-full items-center justify-end rounded px-1.5 text-[10px] font-semibold text-white"
              style={{ width: `${Math.max(6, (value / max) * 100)}%`, backgroundColor: color }}
            >
              {value >= max * 0.15 ? formatNumber(value) : ""}
            </div>
          </div>
          {value < max * 0.15 && (
            <span className="w-10 shrink-0 text-right tabular-nums text-xs text-muted-foreground">
              {formatNumber(value)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Weekday × hour activity heatmap -----------------------------------------

const WEEKDAY_FULL = [
  "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag",
] as const;

// Discrete 5-step intensity scale (GitHub-contribution style). Level 0 = no
// activity; levels 1–4 are quartiles of the *non-zero* values, so a peaky traffic
// distribution still reveals its mid-range patterns instead of collapsing into a
// single bright cell. Colours mix the brand chart hue into the card background in
// OKLab, so they stay perceptually even across the light/dark themes.
const HEATMAP_LEVEL_BG = [
  "var(--color-muted)",
  "color-mix(in oklab, var(--color-chart-2) 25%, var(--color-card))",
  "color-mix(in oklab, var(--color-chart-2) 50%, var(--color-card))",
  "color-mix(in oklab, var(--color-chart-2) 75%, var(--color-card))",
  "var(--color-chart-2)",
];
const HEATMAP_NIGHT_BG = "color-mix(in oklab, var(--color-foreground) 6%, transparent)";
const HEATMAP_LABEL_W = "2.5rem";
const HEATMAP_NIGHT_HOURS = 6; // shade 0–5 Uhr
const HEATMAP_HOUR_TICKS = new Set([0, 6, 12, 18, 23]);

export function Heatmap({ data }: { data: number[][] }) {
  const [active, setActive] = useState<{ wd: number; h: number } | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const kbNav = useRef(false);

  const flat = data.flat();
  const total = flat.reduce((a, b) => a + b, 0);

  // Peak cell and quantile thresholds. Cheap to derive each render
  // (168 cells) — no memoisation needed.
  let peak = { wd: 0, h: 0, v: -1 };
  data.forEach((row, wd) => row.forEach((v, h) => { if (v > peak.v) peak = { wd, h, v }; }));
  const nz = flat.filter((v) => v > 0).sort((a, b) => a - b);
  const quantile = (p: number) => (nz.length ? nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] : 0);
  const t1 = quantile(0.25), t2 = quantile(0.5), t3 = quantile(0.75);
  const level = (v: number) => (v === 0 ? 0 : v <= t1 ? 1 : v <= t2 ? 2 : v <= t3 ? 3 : 4);

  // After a keyboard move, pull DOM focus to the newly active cell (roving tabindex).
  useEffect(() => {
    if (!kbNav.current) return;
    kbNav.current = false;
    const a = active ?? peak;
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${a.wd}-${a.h}"]`)?.focus();
  });

  if (total === 0) return <Empty />;

  const shown = active ?? { wd: peak.wd, h: peak.h };
  const shownValue = data[shown.wd][shown.h];
  const gridStyle = {
    gridTemplateColumns: `${HEATMAP_LABEL_W} repeat(24, minmax(0, 1fr))`,
    gap: "4px",
  } as const;

  return (
    <div>
      {/* Instant readout — never scrolls away; defaults to the peak. */}
      <div className="mb-2 flex items-center gap-2 text-sm">
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: "var(--color-chart-2)" }} />
        {active ? (
          <span>
            <span className="font-semibold text-foreground">{WEEKDAY_FULL[shown.wd]}, {shown.h} Uhr</span>
            <span className="text-muted-foreground"> · {formatNumber(shownValue)} Aufrufe</span>
          </span>
        ) : (
          <span>
            <span className="text-muted-foreground">Spitze: </span>
            <span className="font-semibold text-foreground">{WEEKDAY_FULL[peak.wd]}, {peak.h} Uhr</span>
            <span className="text-muted-foreground"> · {formatNumber(peak.v)} Aufrufe</span>
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 600 }}>
          <div
            ref={gridRef}
            role="grid"
            aria-label="Aktivität nach Wochentag und Stunde"
            className="relative isolate"
            onKeyDown={(e) => {
              const cur = active ?? peak;
              let { wd, h } = cur;
              switch (e.key) {
                case "ArrowLeft": h = Math.max(0, h - 1); break;
                case "ArrowRight": h = Math.min(23, h + 1); break;
                case "ArrowUp": wd = Math.max(0, wd - 1); break;
                case "ArrowDown": wd = Math.min(6, wd + 1); break;
                case "Home": h = 0; break;
                case "End": h = 23; break;
                default: return;
              }
              e.preventDefault();
              kbNav.current = true;
              setActive({ wd, h });
            }}
            onPointerLeave={() => {
              setTip(null);
              if (!gridRef.current?.contains(document.activeElement)) setActive(null);
            }}
          >
            {/* Night band (0–6 Uhr), painted behind the cells. */}
            <div className="pointer-events-none absolute inset-y-0" style={{ left: HEATMAP_LABEL_W, right: 0, zIndex: -10 }} aria-hidden>
              <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${(HEATMAP_NIGHT_HOURS / 24) * 100}%`, background: HEATMAP_NIGHT_BG }} />
            </div>

            {/* Hour axis */}
            <div className="grid items-end pb-1" style={gridStyle} aria-hidden>
              <span />
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className={`text-center text-[10px] tabular-nums ${HEATMAP_HOUR_TICKS.has(h) ? "font-medium text-foreground/70" : "text-transparent"}`}>
                  {h}
                </span>
              ))}
            </div>

            {/* Weekday rows */}
            {data.map((row, wd) => (
              <div key={wd} role="row" className="grid items-center" style={gridStyle}>
                <span className={`pr-1 text-right text-[11px] leading-5 ${shown.wd === wd ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {WEEKDAY_LABELS[wd]}
                </span>
                {row.map((v, h) => {
                  const isPeak = peak.wd === wd && peak.h === h;
                  const isActive = active != null && active.wd === wd && active.h === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      role="gridcell"
                      data-cell={`${wd}-${h}`}
                      tabIndex={(active ? active.wd === wd && active.h === h : isPeak) ? 0 : -1}
                      aria-label={`${WEEKDAY_FULL[wd]} ${h} Uhr: ${formatNumber(v)} Aufrufe`}
                      onPointerEnter={(e) => { setActive({ wd, h }); setTip({ x: e.clientX, y: e.clientY }); }}
                      onPointerMove={(e) => setTip({ x: e.clientX, y: e.clientY })}
                      onPointerDown={(e) => { setActive({ wd, h }); setTip({ x: e.clientX, y: e.clientY }); }}
                      onFocus={() => setActive({ wd, h })}
                      className={`h-5 rounded-[4px] outline-none transition-shadow ${
                        isActive ? "relative z-10 ring-2 ring-foreground" : isPeak ? "relative z-10 ring-1 ring-foreground/50" : ""
                      }`}
                      style={{ backgroundColor: HEATMAP_LEVEL_BG[level(v)] }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              wenig
              {HEATMAP_LEVEL_BG.map((bg, i) => (
                <span key={i} className="inline-block h-3 w-3 rounded-[4px]" style={{ backgroundColor: bg }} />
              ))}
              viel
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-[4px] ring-1 ring-foreground/50" /> Spitze
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded" style={{ background: HEATMAP_NIGHT_BG }} /> Nacht
            </span>
          </div>
        </div>
      </div>

      {/* Cursor tooltip — instant, no native title delay. */}
      {tip && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
          style={{ left: Math.min(tip.x + 14, (typeof window !== "undefined" ? window.innerWidth : 9999) - 160), top: tip.y + 14 }}
        >
          <div className="font-medium text-popover-foreground">{WEEKDAY_FULL[shown.wd]}, {shown.h} Uhr</div>
          <div className="text-muted-foreground">{formatNumber(shownValue)} Aufrufe</div>
        </div>
      )}
    </div>
  );
}

function Empty({ label = "Noch keine Daten" }: { label?: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>;
}

// --- Stacked area (categorical share over time) ------------------------------

export function StackedAreaTrend({
  data,
  series,
  xKey = "month",
  height = 220,
  labelFormatter = shortDate,
}: {
  data: Array<Record<string, number | string>>;
  series: { key: string; label: string; accent: number }[];
  xKey?: string;
  height?: number;
  labelFormatter?: (l: string) => string;
}) {
  if (data.length === 0) return <Empty />;
  return (
    <div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey={xKey} tickFormatter={(l) => labelFormatter(String(l))} tick={AXIS_TICK}
              axisLine={false} tickLine={false} minTickGap={20} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
            <Tooltip
              content={<ChartTooltip labelFormatter={(l) => labelFormatter(String(l))} />}
              cursor={{ stroke: "var(--color-border)" }}
            />
            {series.map((s) => {
              const color = CHART_COLORS[s.accent % CHART_COLORS.length];
              return (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stackId="1"
                  stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.35} isAnimationActive={false} />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: CHART_COLORS[s.accent % CHART_COLORS.length] }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Time-range toggle + timeline slicing helpers ----------------------------

export type RangeKey = "today" | "7d" | "30d" | "all";

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Heute",
  "7d": "7 Tage",
  "30d": "30 Tage",
  all: "Gesamt",
};

const RANGE_ORDER: RangeKey[] = ["today", "7d", "30d", "all"];

export function RangeToggle({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border bg-card p-0.5 text-sm shadow-sm" role="group" aria-label="Zeitraum">
      {RANGE_ORDER.map((k) => {
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            aria-pressed={active}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              active
                ? "bg-secondary text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {RANGE_LABELS[k]}
          </button>
        );
      })}
    </div>
  );
}

function isoDaysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Slice a daily timeline to the selected range, anchored on its latest data point.
 * Anchoring on the last present date (not the wall clock) avoids an empty view when
 * the current day has not been aggregated yet. */
export function sliceTimeline(data: TimelinePoint[], range: RangeKey): TimelinePoint[] {
  if (range === "all" || data.length === 0) return data;
  const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
  const cutoff = isoDaysBefore(data[data.length - 1].date, days - 1);
  return data.filter((p) => p.date >= cutoff);
}

/** Sum the values of a daily timeline over the selected range. */
export function sumTimeline(data: TimelinePoint[], range: RangeKey): number {
  return sliceTimeline(data, range).reduce((acc, p) => acc + p.value, 0);
}
