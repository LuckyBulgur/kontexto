"use client";

// Dashboard component for the admin stats page. The eight thematic sections are
// no longer stacked as one long page; instead a grouped sidebar switches between
// them and only the active section is rendered. recharts (and all chart
// components) still live in this module so next/dynamic can lazy-load them only
// when the chart section is actually rendered.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, Award, CalendarDays, Clock, Eye, Gamepad2, Lightbulb,
  PartyPopper, Repeat, Sparkles, Target, TrendingUp,
  Trophy, Type, Users, Wrench, type LucideIcon,
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AreaTrend, BarRanking, CHART_COLORS, DonutChart, Heatmap, Histogram, KpiCard,
  Panel, RangeToggle, SectionHeader, StackedAreaTrend,
  sliceTimeline, sumTimeline, type RangeKey,
} from "@/components/admin/charts";
import { StatsSidebar, type StatsNavGroup } from "@/components/admin/StatsSidebar";
import {
  formatDecimal, formatHour, formatNumber, formatPercent, fullDate, greeting, shortMonth, trend,
} from "@/lib/format";
import type { GameDifficultyEntry, StatsData, TimelinePoint } from "@/lib/types";

const PAGE_LABELS: Record<string, string> = {
  "/": "Startseite", "/wordle": "Wördle", "/duel": "Kontexto-Duell",
  "/wordle/duel": "Wördle-Duell", other: "Sonstige",
};
const MODE_LABELS: Record<string, string> = {
  kontexto: "Kontexto", duel: "Kontexto-Duell", wordle: "Wördle", infinite: "Unendlich",
  koop: "Kontexto-Koop",
};
const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Leicht", medium: "Mittel", hard: "Schwer",
};
const DEVICE_LABELS: Record<string, string> = {
  desktop: "Desktop", mobile: "Mobil", tablet: "Tablet", unknown: "Unbekannt",
};

const GUESS_BUCKETS = ["1", "2-3", "4-5", "6-10", "11-20", "21-50", "51-100", "100+"];
const TIME_BUCKETS = ["<1 Min", "1-2 Min", "2-5 Min", "5-10 Min", "10-20 Min", "20-45 Min", "45+ Min"];
const RANK_BUCKETS = ["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+"];

const MODE_SERIES = [
  { key: "kontexto", label: "Kontexto", accent: 0 },
  { key: "duel", label: "Kontexto-Duell", accent: 2 },
  { key: "wordle", label: "Wördle", accent: 1 },
  { key: "infinite", label: "Unendlich", accent: 3 },
  { key: "koop", label: "Kontexto-Koop", accent: 4 },
];

/** Daily average guesses per solve, only for days that had at least one solve. */
function avgGuessesPerSolveTimeline(
  guesses: TimelinePoint[], solves: TimelinePoint[],
): TimelinePoint[] {
  const byDate = new Map(guesses.map((p) => [p.date, p.value]));
  const out: TimelinePoint[] = [];
  for (const s of solves) {
    if (s.value > 0) {
      const g = byDate.get(s.date) ?? 0;
      out.push({ date: s.date, value: Math.round((g / s.value) * 10) / 10 });
    }
  }
  return out;
}

/** Next "round" milestone above n (100, 200, 500, 1k, 2k, 5k, 10k, …). */
function nextMilestone(n: number): number {
  if (n < 100) return 100;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const f of [2, 5, 10]) if (n < f * pow) return f * pow;
  return 10 * pow;
}

/** Highest round milestone already reached (0 below 100). */
function lastMilestone(n: number): number {
  if (n < 100) return 0;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const f of [10, 5, 2, 1]) if (n >= f * pow) return f * pow;
  return pow;
}

function WordTable({ rows }: { rows: GameDifficultyEntry[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Noch zu wenig Daten</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="pb-2 font-medium">Wort</th>
            <th className="pb-2 text-right font-medium">Lösungsrate</th>
            <th className="pb-2 text-right font-medium">Ø Versuche</th>
            <th className="pb-2 text-right font-medium">Spiele</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.mode}-${r.game_number}`} className="border-t">
              <td className="py-1.5 font-medium">
                {r.word} <span className="text-xs text-muted-foreground">#{r.game_number}</span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatPercent(r.solve_rate)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatDecimal(r.avg_guesses)}</td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">{formatNumber(r.finished)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Friendly, plain-text summary of today's activity for the greeting header. */
function GreetingHeader({ stats }: { stats: StatsData }) {
  const visitors = stats.visitors.today;
  const guesses = stats.counters_today.guesses ?? 0;
  const solves = stats.counters_today.solves ?? 0;
  const generated = new Date(stats.generated_at);

  let summary: string;
  if (visitors === 0 && guesses === 0) {
    summary = "Heute ist noch alles ruhig. Wähle links einen Bereich für den gesamten Verlauf.";
  } else {
    const solvedPart = solves > 0 ? `, davon ${formatNumber(solves)} gelöst` : "";
    summary = `Heute waren schon ${formatNumber(visitors)} Besucher:innen da und haben `
      + `${formatNumber(guesses)} Wörter geraten${solvedPart}.`;
  }

  return (
    <header className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="text-sm font-medium text-muted-foreground">{greeting()}</div>
      <p className="mt-2 max-w-3xl text-xl font-bold tracking-tight sm:text-2xl">{summary}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        Stand: {fullDate(stats.generated_at.slice(0, 10))},{" "}
        {generated.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
      </p>
    </header>
  );
}

function DefRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t py-2 first:border-t-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className="font-semibold tabular-nums">{value}</span>
        {sub && <span className="ml-1 text-xs text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}

function Milestones({ stats }: { stats: StatsData }) {
  const e = stats.engagement;
  const finished = e.solves_total + e.reveals_total;
  const rows = [
    { label: "Spiele gespielt", value: finished, accent: 2 },
    { label: "Wörter gelöst", value: e.solves_total, accent: 3 },
    { label: "Rateversuche", value: e.guesses_total, accent: 0 },
  ];
  const headline = lastMilestone(finished);
  return (
    <Panel title="Meilensteine" hint="Fortschritt zur nächsten runden Marke">
      {headline >= 100 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-medium">
          <PartyPopper className="h-4 w-4 shrink-0" aria-hidden style={{ color: CHART_COLORS[3] }} />
          Über {formatNumber(headline)} Spiele gespielt!
        </div>
      )}
      <div className="space-y-3">
        {rows.map((r) => {
          const next = nextMilestone(r.value);
          const pct = Math.min(100, Math.round((r.value / next) * 100));
          const color = CHART_COLORS[r.accent % CHART_COLORS.length];
          return (
            <div key={r.label} className="space-y-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{r.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(r.value)} / {formatNumber(next)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// --- Sections ---------------------------------------------------------------
// Each section renders only its body; the shell renders the shared header
// (SectionHeader + optional RangeToggle). Every section accepts the same props
// for uniform rendering, even if it ignores `range`.

interface SectionProps {
  stats: StatsData;
  range: RangeKey;
}

/** Time-bound overview: greeting, range-aware KPIs and overall quality metrics. */
function OverviewSection({ stats, range }: SectionProps) {
  const e = stats.engagement;
  const loyaltyTotal = stats.visitor_loyalty.new + stats.visitor_loyalty.returning;
  const returningRate = loyaltyTotal ? stats.visitor_loyalty.returning / loyaltyTotal : null;

  // Unique visitors are an exact windowed count (today / 7d / 30d) or the
  // all-time HLL estimate; the rest are summed over the window.
  const uniqueForRange =
    range === "today" ? stats.active_users.dau
    : range === "7d" ? stats.active_users.wau
    : range === "30d" ? stats.active_users.mau
    : stats.all_time.unique_visitors;

  return (
    <div className="space-y-4">
      <GreetingHeader stats={stats} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={Users} accent={0} label="Eindeutige Besucher" value={formatNumber(uniqueForRange)}
          spark={sliceTimeline(stats.visitors_timeline, range)} />
        <KpiCard icon={Eye} accent={1} label="Seitenaufrufe" value={formatNumber(sumTimeline(stats.pageviews_timeline, range))}
          spark={sliceTimeline(stats.pageviews_timeline, range)} />
        <KpiCard icon={Gamepad2} accent={2} label="Rateversuche" value={formatNumber(sumTimeline(stats.guesses_timeline, range))}
          spark={sliceTimeline(stats.guesses_timeline, range)} />
        <KpiCard icon={Trophy} accent={3} label="Lösungen" value={formatNumber(sumTimeline(stats.solves_timeline, range))}
          spark={sliceTimeline(stats.solves_timeline, range)} />
      </div>

      <p className="pt-2 text-xs font-medium text-muted-foreground">Qualität & Bindung (gesamt)</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={Target} accent={4} label="Lösungsrate" value={formatPercent(e.solve_rate)} />
        <KpiCard icon={Activity} accent={0} label="Ø Versuche/Lösung" value={formatDecimal(e.avg_guesses_per_solve)} />
        <KpiCard icon={Lightbulb} accent={3} label="Tipps genutzt" value={formatNumber(e.hints_total)} />
        <KpiCard icon={Repeat} accent={1} label="Wiederkehrer" value={formatPercent(returningRate)}
          sub={`${formatNumber(stats.visitor_loyalty.returning)} von ${formatNumber(loyaltyTotal)}`} />
      </div>
    </div>
  );
}

/** All-time totals plus records and active-visitor panels. */
function TotalsSection({ stats }: SectionProps) {
  const at = stats.all_time;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={Users} accent={0} label="Eindeutige Besucher (gesamt)" value={formatNumber(at.unique_visitors)}
          sub={at.unique_since ? `geschätzt · seit ${fullDate(at.unique_since)}` : "geschätzt"} />
        <KpiCard icon={Eye} accent={1} label="Seitenaufrufe (gesamt)" value={formatNumber(at.pageviews)}
          sub={at.data_since ? `seit ${fullDate(at.data_since)}` : undefined} />
        <KpiCard icon={CalendarDays} accent={2} label="Besuchertage" value={formatNumber(at.visitor_days)}
          sub="Summe täglicher Besucher" />
        <KpiCard icon={Clock} accent={4} label="Aktiv (30 Tage)" value={formatNumber(stats.active_users.mau)}
          sub={`7 T: ${formatNumber(stats.active_users.wau)} · heute: ${formatNumber(stats.active_users.dau)}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Rekorde" hint="bester einzelner Tag">
          <div>
            <DefRow label="Meiste Besucher"
              value={stats.records.best_visitors_day ? formatNumber(stats.records.best_visitors_day.value) : "k. A."}
              sub={stats.records.best_visitors_day ? `am ${fullDate(stats.records.best_visitors_day.date)}` : undefined} />
            <DefRow label="Meiste Rateversuche"
              value={stats.records.best_guesses_day ? formatNumber(stats.records.best_guesses_day.value) : "k. A."}
              sub={stats.records.best_guesses_day ? `am ${fullDate(stats.records.best_guesses_day.date)}` : undefined} />
          </div>
        </Panel>
        <Panel title="Aktive Besucher" hint="eindeutige Besucher im Zeitfenster">
          <div>
            <DefRow label="Heute (DAU)" value={formatNumber(stats.active_users.dau)} />
            <DefRow label="Letzte 7 Tage (WAU)" value={formatNumber(stats.active_users.wau)} />
            <DefRow label="Letzte 30 Tage (MAU)" value={formatNumber(stats.active_users.mau)} />
            <DefRow label="Klebrigkeit (Tag/Monat)" value={formatPercent(stats.stickiness)} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** This month versus last month, plus the monthly unique-visitor trend. */
function GrowthSection({ stats }: SectionProps) {
  const months = stats.monthly;
  const thisMonth = months.length ? months[months.length - 1] : null;
  const lastMonth = months.length >= 2 ? months[months.length - 2] : null;
  const monthlyVisitors = months.map((m) => ({ date: m.month, value: m.unique_visitors }));

  if (!thisMonth) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard icon={Users} accent={0} label="Eindeutige Besucher" value={formatNumber(thisMonth.unique_visitors)}
          sub="dieser Monat" trend={lastMonth ? trend(thisMonth.unique_visitors, lastMonth.unique_visitors) : null} />
        <KpiCard icon={Eye} accent={1} label="Seitenaufrufe" value={formatNumber(thisMonth.pageviews)}
          sub="dieser Monat" trend={lastMonth ? trend(thisMonth.pageviews, lastMonth.pageviews) : null} />
        <KpiCard icon={Gamepad2} accent={2} label="Spiele" value={formatNumber(thisMonth.games)}
          sub="dieser Monat" trend={lastMonth ? trend(thisMonth.games, lastMonth.games) : null} />
      </div>
      <Panel title="Eindeutige Besucher pro Monat" hint="HLL-Schätzung">
        <AreaTrend data={monthlyVisitors} accent={0} labelFormatter={shortMonth} />
      </Panel>
    </div>
  );
}

/** Reach: visitor/pageview timelines, device/browser/OS splits, pages, referrers, heatmap. */
function ReachSection({ stats, range }: SectionProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Unique-Besucher im Zeitverlauf">
        <AreaTrend data={sliceTimeline(stats.visitors_timeline, range)} accent={0} />
      </Panel>
      <Panel title="Seitenaufrufe im Zeitverlauf">
        <AreaTrend data={sliceTimeline(stats.pageviews_timeline, range)} accent={1} />
      </Panel>
      <Panel title="Geräte"><DonutChart data={stats.devices} labelMap={DEVICE_LABELS} /></Panel>
      <Panel title="Browser"><DonutChart data={stats.browsers} /></Panel>
      <Panel title="Betriebssysteme">
        <DonutChart data={stats.os} />
      </Panel>
      <Panel title="Beliebteste Seiten">
        <BarRanking data={stats.pageviews_by_page} accent={1} labelMap={PAGE_LABELS} />
      </Panel>
      <Panel title="Woher kommen die Besucher?" className="lg:col-span-2">
        <BarRanking data={stats.referrers} accent={2} emptyLabel="Keine externen Verweise" max={15} />
      </Panel>
      <Panel title="Heute nach Stunde" hint="Seitenaufrufe (Ortszeit)" className="lg:col-span-2">
        {stats.today_hourly.some((v) => v > 0) ? (
          <AreaTrend
            data={stats.today_hourly.map((value, h) => ({ date: String(h), value }))}
            accent={1}
            labelFormatter={formatHour}
          />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Heute noch keine Aufrufe</p>
        )}
      </Panel>
      <Panel title="Wann wird gespielt? (Wochentag × Stunde, Ortszeit)" className="lg:col-span-2">
        <Heatmap data={stats.activity_heatmap} />
      </Panel>
    </div>
  );
}

/** Gameplay: guess/solve trends, mode popularity, and outcome distributions. */
function GameplaySection({ stats, range }: SectionProps) {
  const dist = stats.distributions ?? {};
  const avgPerSolve = avgGuessesPerSolveTimeline(stats.guesses_timeline, stats.solves_timeline);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Rateversuche pro Tag">
        <AreaTrend data={sliceTimeline(stats.guesses_timeline, range)} accent={2} />
      </Panel>
      <Panel title="Lösungen pro Tag">
        <AreaTrend data={sliceTimeline(stats.solves_timeline, range)} accent={3} />
      </Panel>
      <Panel title="Lösungsrate-Trend">
        <AreaTrend data={sliceTimeline(stats.solve_rate_timeline, range)} accent={3} valueFormatter={(v) => formatPercent(Number(v))} />
      </Panel>
      <Panel title="Ø Versuche bis zur Lösung: Trend">
        <AreaTrend data={sliceTimeline(avgPerSolve, range)} accent={0} valueFormatter={(v) => formatDecimal(Number(v))} />
      </Panel>
      <Panel title="Modus-Beliebtheit über Zeit" hint="abgeschlossene Spiele/Monat" className="lg:col-span-2">
        <StackedAreaTrend data={stats.mode_monthly} series={MODE_SERIES} xKey="month" labelFormatter={shortMonth} />
      </Panel>
      <Panel title="Spiele je Modus (abgeschlossen)">
        <DonutChart data={stats.games_by_mode} labelMap={MODE_LABELS} />
      </Panel>
      <Panel title="Tipps nach Schwierigkeit">
        <BarRanking data={stats.hints_by_difficulty} accent={3} labelMap={DIFFICULTY_LABELS}
          emptyLabel="Noch keine Tipps genutzt" />
      </Panel>
      <Panel title="Versuche bis zur Lösung: Kontexto">
        <Histogram data={dist["dist_guesses_kontexto"] ?? {}} order={GUESS_BUCKETS} accent={2} />
      </Panel>
      <Panel title="Zeit bis zur Lösung: Kontexto">
        <Histogram data={dist["dist_time_kontexto"] ?? {}} order={TIME_BUCKETS} accent={0} />
      </Panel>
      <Panel title="Versuche bis zur Lösung: Unendlich">
        <Histogram data={dist["dist_guesses_infinite"] ?? {}} order={GUESS_BUCKETS} accent={3} />
      </Panel>
      <Panel title="Zeit bis zur Lösung: Unendlich">
        <Histogram data={dist["dist_time_infinite"] ?? {}} order={TIME_BUCKETS} accent={3} />
      </Panel>
      <Panel title="Bester Rang beim Aufgeben: Kontexto und Unendlich">
        <Histogram data={dist["dist_giveup_rank"] ?? {}} order={RANK_BUCKETS} accent={4} />
      </Panel>
      <Panel title="Versuche bis zur Lösung: Wördle">
        <Histogram data={dist["dist_guesses_wordle"] ?? {}} order={GUESS_BUCKETS} accent={1} />
      </Panel>
    </div>
  );
}

/** Words: most guessed words and hardest/easiest solution words. */
function WordsSection({ stats }: SectionProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Häufigste Rateversuche" className="lg:col-span-2">
        <BarRanking
          data={stats.top_words.map((w) => ({ label: w.word, value: w.count }))}
          accent={2}
          emptyLabel="Noch keine Wörter geraten"
        />
      </Panel>
      <Panel title="Schwerste Lösungswörter" hint="ab 3 abgeschlossenen Spielen">
        <WordTable rows={stats.game_difficulty?.hardest ?? []} />
      </Panel>
      <Panel title="Leichteste Lösungswörter" hint="ab 3 abgeschlossenen Spielen">
        <WordTable rows={stats.game_difficulty?.easiest ?? []} />
      </Panel>
    </div>
  );
}

/** Milestone progress bars. */
function MilestonesSection({ stats }: SectionProps) {
  return <Milestones stats={stats} />;
}

/** Methodology and technical notes (collapsible). */
function MethodologySection({ stats }: SectionProps) {
  return (
    <div className="rounded-2xl border bg-card px-4 shadow-sm sm:px-5">
      <Accordion type="single" collapsible>
        <AccordionItem value="methodik" className="border-none">
          <AccordionTrigger className="text-sm">Datenerhebung & Hinweise</AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm text-muted-foreground">
            <p>{stats.note}</p>
            <ul className="space-y-1">
              <li>Herausgefilterte Bots: <span className="font-medium text-foreground">{formatNumber(stats.bots_filtered)}</span></li>
              <li>Duelle erstellt: <span className="font-medium text-foreground">
                {formatNumber(Object.values(stats.duels_created ?? {}).reduce((a, b) => a + b, 0))}</span>
                {Object.keys(stats.duels_created ?? {}).length > 0 && (
                  <span> ({Object.entries(stats.duels_created).map(([k, v]) =>
                    `${MODE_LABELS[k] ?? k}: ${formatNumber(v)}`).join(" · ")})</span>
                )}
              </li>
              <li>Klebrigkeit (Tag/Monat): <span className="font-medium text-foreground">{formatPercent(stats.stickiness)}</span></li>
              <li>Rohdaten-Aufbewahrung: 35 Tage, danach nur aggregierte Werte.</li>
              <li>Stand: <span className="font-medium text-foreground">{fullDate(stats.generated_at.slice(0, 10))}, {new Date(stats.generated_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr</span></li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// --- Section registry (single source of truth) ------------------------------

type SectionGroup = "DASHBOARD" | "REICHWEITE" | "SPIEL" | "SYSTEM";

const GROUP_ORDER: SectionGroup[] = ["DASHBOARD", "REICHWEITE", "SPIEL", "SYSTEM"];
const GROUP_TITLES: Record<SectionGroup, string> = {
  DASHBOARD: "Dashboard",
  REICHWEITE: "Reichweite",
  SPIEL: "Spiel",
  SYSTEM: "System",
};

interface SectionDef {
  id: string;
  group: SectionGroup;
  /** Sidebar label. */
  label: string;
  /** Header title; defaults to `label`. */
  title?: string;
  description?: string;
  icon: LucideIcon;
  /** Show the time-range toggle in the section header. */
  usesRange?: boolean;
  /** Hide the section (and its nav entry) when this returns false. */
  available?: (stats: StatsData) => boolean;
  Component: (props: SectionProps) => ReactNode;
}

const SECTIONS: SectionDef[] = [
  {
    id: "overview", group: "DASHBOARD", label: "Überblick", icon: Sparkles,
    description: "Zeitbezogene Kennzahlen", usesRange: true, Component: OverviewSection,
  },
  {
    id: "reach", group: "REICHWEITE", label: "Besucher & Reichweite", icon: Users,
    description: "Woher sie kommen und wann sie da sind", usesRange: true, Component: ReachSection,
  },
  {
    id: "growth", group: "REICHWEITE", label: "Wachstum", icon: TrendingUp,
    description: "Dieser Monat im Vergleich zum letzten",
    available: (s) => s.monthly.length > 0, Component: GrowthSection,
  },
  {
    id: "totals", group: "REICHWEITE", label: "Gesamtzahlen", icon: Award,
    title: "Seit Beginn der Zählung", description: "Gesamtzahlen über die komplette Historie",
    Component: TotalsSection,
  },
  {
    id: "gameplay", group: "SPIEL", label: "Spielverhalten", icon: Gamepad2,
    description: "Wie gespielt, gelöst und aufgegeben wird", usesRange: true, Component: GameplaySection,
  },
  {
    id: "words", group: "SPIEL", label: "Wörter", icon: Type,
    description: "Was geraten wird und welche Lösungswörter schwerfallen", Component: WordsSection,
  },
  {
    id: "milestones", group: "SYSTEM", label: "Meilensteine", icon: PartyPopper,
    description: "Was bisher zusammengekommen ist", Component: MilestonesSection,
  },
  {
    id: "methodology", group: "SYSTEM", label: "Methodik & Technik", icon: Wrench,
    description: "Wie diese Zahlen erhoben werden", Component: MethodologySection,
  },
];

// --- Shell ------------------------------------------------------------------

export default function Dashboard({ stats }: { stats: StatsData }) {
  const [range, setRange] = useState<RangeKey>("30d");

  const availableSections = useMemo(
    () => SECTIONS.filter((s) => !s.available || s.available(stats)),
    [stats],
  );

  const [activeId, setActiveId] = useState<string>(() => {
    const fromHash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    return availableSections.some((s) => s.id === fromHash)
      ? fromHash
      : availableSections[0].id;
  });

  // Keep the active section in sync with the URL hash so deep-links, reloads and
  // browser back/forward navigation all resolve to the right section.
  useEffect(() => {
    const sync = () => {
      const fromHash = window.location.hash.slice(1);
      setActiveId(
        availableSections.some((s) => s.id === fromHash) ? fromHash : availableSections[0].id,
      );
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [availableSections]);

  const selectSection = useCallback((id: string) => {
    setActiveId(id);
    window.history.pushState(null, "", `#${id}`);
  }, []);

  const navGroups: StatsNavGroup[] = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        title: GROUP_TITLES[group],
        items: availableSections
          .filter((s) => s.group === group)
          .map((s) => ({ id: s.id, label: s.label, icon: s.icon })),
      })).filter((g) => g.items.length > 0),
    [availableSections],
  );

  const active = availableSections.find((s) => s.id === activeId) ?? availableSections[0];
  const ActiveSection = active.Component;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <StatsSidebar groups={navGroups} activeId={active.id} onSelect={selectSection} />
      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader icon={active.icon} title={active.title ?? active.label} description={active.description} />
          {active.usesRange && <RangeToggle value={range} onChange={setRange} />}
        </div>
        <ActiveSection stats={stats} range={range} />
      </div>
    </div>
  );
}
