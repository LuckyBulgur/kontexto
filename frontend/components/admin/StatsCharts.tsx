"use client";

// Dashboard component containing all recharts-based charts for the admin stats
// page. Extracted so next/dynamic can lazy-load it (and recharts with it) only
// when the chart section is actually rendered.

import { useState } from "react";
import {
  Activity, Award, CalendarDays, Clock, Eye, Gamepad2, Lightbulb,
  PartyPopper, Repeat, Sparkles, Target, TrendingUp,
  Trophy, Type, Users, Wrench,
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AreaTrend, BarRanking, CHART_COLORS, DonutChart, Heatmap, Histogram, KpiCard,
  Panel, RANGE_LABELS, RangeToggle, SectionHeader, StackedAreaTrend,
  sliceTimeline, sumTimeline, type RangeKey,
} from "@/components/admin/charts";
import {
  formatDecimal, formatNumber, formatPercent, fullDate, greeting, shortMonth, trend,
} from "@/lib/format";
import type { GameDifficultyEntry, StatsData, TimelinePoint } from "@/lib/types";

const PAGE_LABELS: Record<string, string> = {
  "/": "Startseite", "/wordle": "Wördle", "/duel": "Kontexto-Duell",
  "/wordle/duel": "Wördle-Duell", other: "Sonstige",
};
const MODE_LABELS: Record<string, string> = {
  kontexto: "Kontexto", duel: "Kontexto-Duell", wordle: "Wördle",
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
    summary = "Heute ist noch alles ruhig – unten siehst du den gesamten Verlauf.";
  } else {
    const solvedPart = solves > 0 ? `, davon ${formatNumber(solves)} gelöst` : "";
    summary = `Heute waren schon ${formatNumber(visitors)} Besucher:innen da und haben `
      + `${formatNumber(guesses)} Wörter geraten${solvedPart}. 🎉`;
  }

  return (
    <header
      className="rounded-3xl border p-6 shadow-sm sm:p-8"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--color-chart-1) 14%, var(--color-card)), "
          + "color-mix(in oklab, var(--color-chart-4) 8%, var(--color-card)))",
      }}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Sparkles className="h-4 w-4" aria-hidden />
        {greeting()}!
      </div>
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
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export default function Dashboard({ stats }: { stats: StatsData }) {
  const [range, setRange] = useState<RangeKey>("30d");

  const e = stats.engagement;
  const dist = stats.distributions ?? {};
  const finishedGames = e.solves_total + e.reveals_total;
  const loyaltyTotal = stats.visitor_loyalty.new + stats.visitor_loyalty.returning;
  const returningRate = loyaltyTotal ? stats.visitor_loyalty.returning / loyaltyTotal : null;

  // Range-aware overview figures. Unique visitors are an exact windowed count
  // (today / 7d / 30d) or the all-time HLL estimate; the rest are summed.
  const uniqueForRange =
    range === "today" ? stats.active_users.dau
    : range === "7d" ? stats.active_users.wau
    : range === "30d" ? stats.active_users.mau
    : stats.all_time.unique_visitors;

  const at = stats.all_time;
  const months = stats.monthly;
  const thisMonth = months.length ? months[months.length - 1] : null;
  const lastMonth = months.length >= 2 ? months[months.length - 2] : null;
  const monthlyVisitors = months.map((m) => ({ date: m.month, value: m.unique_visitors }));
  const avgPerSolve = avgGuessesPerSolveTimeline(stats.guesses_timeline, stats.solves_timeline);

  return (
    <div className="space-y-12">
      <GreetingHeader stats={stats} />

      {/* --- Überblick (zeitraum-gesteuert) -------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader icon={Sparkles} title="Überblick" description={`Zeitbezogene Kennzahlen für: ${RANGE_LABELS[range]}`} />
          <RangeToggle value={range} onChange={setRange} />
        </div>
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
      </section>

      {/* --- Seit Beginn der Zählung --------------------------------------- */}
      <section className="space-y-4">
        <SectionHeader icon={Award} title="Seit Beginn der Zählung" description="Gesamtzahlen über die komplette Historie" />
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
                value={stats.records.best_visitors_day ? formatNumber(stats.records.best_visitors_day.value) : "–"}
                sub={stats.records.best_visitors_day ? `am ${fullDate(stats.records.best_visitors_day.date)}` : undefined} />
              <DefRow label="Meiste Rateversuche"
                value={stats.records.best_guesses_day ? formatNumber(stats.records.best_guesses_day.value) : "–"}
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
      </section>

      {/* --- Wachstum / Monatsvergleich ------------------------------------ */}
      {thisMonth && (
        <section className="space-y-4">
          <SectionHeader icon={TrendingUp} title="Wachstum" description="Dieser Monat im Vergleich zum letzten" />
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
        </section>
      )}

      {/* --- Besucher & Reichweite ----------------------------------------- */}
      <section className="space-y-4">
        <SectionHeader icon={Users} title="Besucher & Reichweite" description="Woher sie kommen und wann sie da sind" />
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
          <Panel title="Wann wird gespielt? (Wochentag × Stunde, Ortszeit)" className="lg:col-span-2">
            <Heatmap data={stats.activity_heatmap} />
          </Panel>
        </div>
      </section>

      {/* --- Spielverhalten ------------------------------------------------- */}
      <section className="space-y-4">
        <SectionHeader icon={Gamepad2} title="Spielverhalten" description="Wie gespielt, gelöst und aufgegeben wird" />
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
          <Panel title="Ø Versuche bis zur Lösung – Trend">
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
          <Panel title="Versuche bis zur Lösung – Kontexto">
            <Histogram data={dist["dist_guesses_kontexto"] ?? {}} order={GUESS_BUCKETS} accent={2} />
          </Panel>
          <Panel title="Zeit bis zur Lösung – Kontexto">
            <Histogram data={dist["dist_time_kontexto"] ?? {}} order={TIME_BUCKETS} accent={0} />
          </Panel>
          <Panel title="Bester Rang beim Aufgeben – Kontexto">
            <Histogram data={dist["dist_giveup_rank"] ?? {}} order={RANK_BUCKETS} accent={4} />
          </Panel>
          <Panel title="Versuche bis zur Lösung – Wördle">
            <Histogram data={dist["dist_guesses_wordle"] ?? {}} order={GUESS_BUCKETS} accent={1} />
          </Panel>
        </div>
      </section>

      {/* --- Wörter --------------------------------------------------------- */}
      <section className="space-y-4">
        <SectionHeader icon={Type} title="Wörter" description="Was geraten wird und welche Lösungswörter schwerfallen" />
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
      </section>

      {/* --- Meilensteine --------------------------------------------------- */}
      <section className="space-y-4">
        <SectionHeader icon={PartyPopper} title="Meilensteine" description="Was bisher zusammengekommen ist" />
        <Milestones stats={stats} />
      </section>

      {/* --- Methodik & Technik (eingeklappt) ------------------------------ */}
      <section className="space-y-4">
        <SectionHeader icon={Wrench} title="Methodik & Technik" description="Wie diese Zahlen erhoben werden" />
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
      </section>
    </div>
  );
}
