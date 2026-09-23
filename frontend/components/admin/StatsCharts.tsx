"use client";

// Dashboard component for the admin stats page. The eight thematic sections are
// no longer stacked as one long page; instead a grouped sidebar switches between
// them and only the active section is rendered. recharts (and all chart
// components) still live in this module so next/dynamic can lazy-load them only
// when the chart section is actually rendered.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, Award, CalendarDays, Clock, Eye, Gamepad2, Lightbulb, Megaphone,
  MessageCircleQuestion, PartyPopper, Repeat, Share2, Sparkles, Target, ThumbsUp, TrendingUp,
  Trophy, Type, Users, Wrench, type LucideIcon,
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AreaTrend, BarRanking, CHART_COLORS, DonutChart, Heatmap, Histogram, KpiCard,
  GroupedBars, Panel, RangeToggle, SectionHeader, StackedAreaTrend,
  sliceTimeline, sumTimeline, type RangeKey,
} from "@/components/admin/charts";
import { StatsSidebar, type StatsNavGroup } from "@/components/admin/StatsSidebar";
import WordQuality from "@/components/admin/WordQuality";
import {
  formatDecimal, formatDuration, formatHour, formatNumber, formatPercent, formatStamp, fullDate, greeting,
  shortMonth, trend,
} from "@/lib/format";
import type { GameDifficultyEntry, StatsData, TimelinePoint } from "@/lib/types";

const PAGE_LABELS: Record<string, string> = {
  "/": "Startseite", "/wordle": "Wördle", "/duel": "Kontexto-Duell",
  "/wordle/duel": "Wördle-Duell", other: "Sonstige",
};
// Every mode the backend can count (analytics.GAME_MODES). A missing entry here
// would show the raw key to the reader, which is how a new mode quietly turns
// into "timerush" in the dashboard.
const MODE_LABELS: Record<string, string> = {
  kontexto: "Kontexto", infinite: "Unendlich", wordle: "Wördle",
  duel: "Kontexto-Duell", koop: "Kontexto-Koop", wordle_duel: "Wördle-Duell",
  royale: "Battle Royale", blitz: "Blitz-Duell", timerush: "Zeitbonus-Jagd",
  leiter: "Leiter", limit: "Limitierte Versuche", doppel: "Doppelziel",
  suddendeath: "Sudden Death",
};
const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Leicht", medium: "Mittel", hard: "Schwer",
};
const SURVEY_LABELS: Record<string, string> = {
  search: "Google/Suche", friends: "Freunde", tiktok: "TikTok", instagram: "Instagram",
  youtube: "YouTube", twitch: "Twitch", reddit: "Reddit", other_game: "Anderes Spiel",
  random: "Zufall", other: "Anderes",
};
const DEVICE_LABELS: Record<string, string> = {
  desktop: "Desktop", mobile: "Mobil", tablet: "Tablet", unknown: "Unbekannt",
};

const GUESS_BUCKETS = ["1", "2-3", "4-5", "6-10", "11-20", "21-50", "51-100", "100+"];
const TIME_BUCKETS = ["<1 Min", "1-2 Min", "2-5 Min", "5-10 Min", "10-20 Min", "20-45 Min", "45+ Min"];
const RANK_BUCKETS = ["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+"];

/**
 * The popularity trend groups the thirteen modes into five families.
 *
 * Not a simplification for its own sake: there are five chart accents, and
 * thirteen stacked bands over five colours is a picture nobody can read. The
 * per-mode figures stay available one panel down, in the donut, where a single
 * colour and thirteen labels work fine.
 */
const MODE_FAMILIES = [
  { key: "kontexto", label: "Kontexto täglich", accent: 0, members: ["kontexto"] },
  { key: "wordle", label: "Wördle", accent: 1, members: ["wordle", "wordle_duel"] },
  { key: "multiplayer", label: "Mehrspieler", accent: 2, members: ["duel", "koop", "royale", "blitz", "timerush"] },
  { key: "infinite", label: "Unendlich", accent: 3, members: ["infinite"] },
  { key: "solo", label: "Solo-Modi", accent: 4, members: ["leiter", "limit", "doppel", "suddendeath"] },
];

const MODE_SERIES = MODE_FAMILIES.map(({ key, label, accent }) => ({ key, label, accent }));

/** Sum each month's per-mode counts into the five families. */
function modeFamilyTrend(
  monthly: ({ month: string } & Record<string, number | string>)[],
): Record<string, number | string>[] {
  return monthly.map((point) => {
    const row: Record<string, number | string> = { month: point.month };
    for (const family of MODE_FAMILIES) {
      row[family.key] = family.members.reduce(
        (sum, member) => sum + (Number(point[member]) || 0),
        0,
      );
    }
    return row;
  });
}

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
    return <p className="py-6 text-center text-small text-muted-foreground">Noch zu wenig Daten</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-small">
        <thead>
          <tr className="text-left text-micro text-muted-foreground">
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
                {r.word} <span className="text-micro text-muted-foreground">#{r.game_number}</span>
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

  let summary: string;
  if (visitors === 0 && guesses === 0) {
    summary = "Heute ist noch alles ruhig. Wähle links einen Bereich für den gesamten Verlauf.";
  } else {
    const solvedPart = solves > 0 ? `, davon ${formatNumber(solves)} gelöst` : "";
    summary = `Heute waren schon ${formatNumber(visitors)} Besucher:innen da und haben `
      + `${formatNumber(guesses)} Wörter geraten${solvedPart}.`;
  }

  return (
    <header className="rounded-xl border bg-card p-6 sm:p-8">
      <div className="text-small font-medium text-muted-foreground">{greeting()}</div>
      <p className="mt-2 max-w-3xl text-h3 font-bold tracking-tight sm:text-h2">{summary}</p>
      <p className="mt-3 text-micro text-muted-foreground">
        Stand: {formatStamp(stats.generated_at)}
      </p>
    </header>
  );
}

function DefRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t py-2 first:border-t-0">
      <span className="text-small text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className="font-semibold tabular-nums">{value}</span>
        {sub && <span className="ml-1 text-micro text-muted-foreground">{sub}</span>}
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
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-small font-medium">
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
              <div className="flex items-baseline justify-between text-small">
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

      <p className="pt-2 text-micro font-medium text-muted-foreground">Qualität & Bindung (gesamt)</p>
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
          sub={at.unique_since ? `geschätzt, seit ${fullDate(at.unique_since)}` : "geschätzt"} />
        <KpiCard icon={Eye} accent={1} label="Seitenaufrufe (gesamt)" value={formatNumber(at.pageviews)}
          sub={at.data_since ? `seit ${fullDate(at.data_since)}` : undefined} />
        <KpiCard icon={CalendarDays} accent={2} label="Besuchertage" value={formatNumber(at.visitor_days)}
          sub="Summe täglicher Besucher" />
        <KpiCard icon={Clock} accent={4} label="Aktiv (30 Tage)" value={formatNumber(stats.active_users.mau)}
          sub={`7 Tage ${formatNumber(stats.active_users.wau)}, heute ${formatNumber(stats.active_users.dau)}`} />
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
          <p className="py-6 text-center text-small text-muted-foreground">Heute noch keine Aufrufe</p>
        )}
      </Panel>
      <Panel title="Wann wird gespielt? (Wochentag × Stunde, Ortszeit)" className="lg:col-span-2">
        <Heatmap data={stats.activity_heatmap} />
      </Panel>
    </div>
  );
}

/** Self-reported attribution: where players say they heard about Kontexto.
 * Complements the referrer data, which is blind to word of mouth, messenger
 * links and any mention in a video. */
function SurveySection({ stats }: SectionProps) {
  const survey = stats.survey;
  const answered = survey.total;

  if (answered === 0) {
    return (
      <Panel title="Woher kennen sie Kontexto?">
        <p className="py-6 text-center text-small text-muted-foreground">
          Noch keine Antworten. Die Frage erscheint auf der Ergebniskarte eines beendeten Spiels.
        </p>
      </Panel>
    );
  }

  const latestMonth = survey.sources_monthly.length
    ? survey.sources_monthly[survey.sources_monthly.length - 1]
    : null;
  const leader = Object.entries(survey.sources).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3 lg:col-span-2 sm:grid-cols-3">
        <KpiCard icon={MessageCircleQuestion} accent={0} label="Antworten" value={formatNumber(answered)} />
        <KpiCard icon={Award} accent={2} label="Stärkster Kanal"
          value={SURVEY_LABELS[leader[0]] ?? leader[0]}
          sub={`${formatNumber(leader[1])} von ${formatNumber(answered)}`} />
        <KpiCard icon={Type} accent={3} label="Freitexte" value={formatNumber(survey.recent_details.length)}
          sub="neueste, ohne Besucherbezug" />
      </div>
      <Panel title="Antworten nach Kanal" hint="gesamt" className="lg:col-span-2">
        <BarRanking data={survey.sources} accent={0} labelMap={SURVEY_LABELS} />
      </Panel>
      {latestMonth && (
        <Panel title="Aktueller Monat" hint={shortMonth(latestMonth.month)}>
          <BarRanking data={latestMonth.sources} accent={2} labelMap={SURVEY_LABELS} />
        </Panel>
      )}
      <Panel title="Freitexte" hint="neueste zuerst">
        {survey.recent_details.length === 0 ? (
          <p className="py-6 text-center text-small text-muted-foreground">Noch keine Freitexte</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {survey.recent_details.map((entry, index) => (
              <li key={`${entry.date}-${index}`} className="border-b pb-2 last:border-0 last:pb-0">
                <p className="text-small">{entry.detail}</p>
                <p className="text-micro text-muted-foreground">
                  {SURVEY_LABELS[entry.source] ?? entry.source}, {fullDate(entry.date)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

const AD_CONSENT_LABELS: Record<string, string> = {
  shown: "Banner gesehen", required: "Als Pflichtabfrage", granted: "Akzeptiert", denied: "Abgelehnt",
  regranted: "Später akzeptiert", revoked: "Widerrufen",
};
const AD_CONSENT_SERIES = [
  { key: "granted", label: "Akzeptiert", accent: 1 },
  { key: "denied", label: "Abgelehnt", accent: 3 },
];

/** How visitors answer the ad consent banner.
 *
 * The rate is taken over the answers, and the share without an answer is shown
 * next to it, because a banner that most people ignore makes a high acceptance
 * rate mean little. Both come from the same 30 days and the same visitors, since
 * every kind is counted once per visitor and month. */
function AdConsentSection({ stats }: SectionProps) {
  const { totals, last_30_days: recent } = stats.ad_consent;
  // The series starts on the first day anything was counted: ninety empty days
  // in front of it squeeze the data into the right edge of the chart.
  const firstActive = stats.ad_consent.daily.findIndex((row) =>
    Object.entries(row).some(([key, value]) => key !== "date" && typeof value === "number" && value > 0));
  const daily = firstActive === -1 ? [] : stats.ad_consent.daily.slice(firstActive);

  if (totals.shown === 0 && totals.granted + totals.denied === 0) {
    return (
      <Panel title="Werbe-Einwilligung">
        <p className="py-6 text-center text-small text-muted-foreground">
          Noch keine Daten. Gezählt wird, sobald das Banner zum ersten Mal erscheint.
        </p>
      </Panel>
    );
  }

  const answered = recent.granted + recent.denied;
  const acceptRate = answered > 0 ? recent.granted / answered : null;
  const unanswered = recent.shown > 0 ? Math.max(0, recent.shown - answered) / recent.shown : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-5">
        <KpiCard icon={Eye} accent={0} label="Banner gesehen" value={formatNumber(recent.shown)}
          sub="letzte 30 Tage" />
        <KpiCard icon={ThumbsUp} accent={1} label="Zustimmungsquote" value={formatPercent(acceptRate)}
          sub={`${formatNumber(recent.granted)} von ${formatNumber(answered)} Antworten`} />
        <KpiCard icon={Clock} accent={2} label="Ohne Antwort" value={formatPercent(unanswered)}
          sub="Banner gesehen, nichts gewählt" />
        <KpiCard icon={Target} accent={4} label="Pflichtabfrage" value={formatNumber(recent.required)}
          sub="wiederkehrend, ohne Antwort" />
        <KpiCard icon={Repeat} accent={3} label="Widerrufen" value={formatNumber(recent.revoked)}
          sub={`${formatNumber(recent.regranted)} später akzeptiert`} />
      </div>
      <Panel title="Antworten pro Tag" hint="seit Beginn, höchstens 90 Tage" className="lg:col-span-2">
        <GroupedBars data={daily} series={AD_CONSENT_SERIES} xKey="date" />
      </Panel>

      <Panel title="Seit Beginn der Zählung" hint="gesamt" className="lg:col-span-2">
        <BarRanking data={totals} accent={0} labelMap={AD_CONSENT_LABELS} />
      </Panel>
    </div>
  );
}

/** The growth funnel: started versus finished games, sharing, attention.
 *
 * These three answer what the visitor counts cannot: how many games are begun
 * and dropped, whether results are shared and whether those shares bring anyone
 * back, and how long a page is actually looked at. */
function FunnelSection({ stats }: SectionProps) {
  const { funnel, sharing, attention } = stats;
  const pageviews = Object.values(stats.pageviews_by_page).reduce((a, b) => a + b, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3 lg:col-span-2 sm:grid-cols-4">
        <KpiCard icon={Gamepad2} accent={2} label="Begonnene Spiele"
          value={formatNumber(funnel.starts_total)} />
        <KpiCard icon={Target} accent={0} label="Abschlussquote"
          value={formatPercent(funnel.completion_rate)}
          sub={`${formatNumber(funnel.finished_total)} beendet`} />
        <KpiCard icon={Share2} accent={3} label="Teilen gedrückt"
          value={formatNumber(sharing.shares_total)} />
        <KpiCard icon={Users} accent={1} label="Über geteilte Links"
          value={formatNumber(sharing.arrivals_total)}
          sub={sharing.arrivals_per_share !== null
            ? `${formatDecimal(sharing.arrivals_per_share)} je Teilen`
            : undefined} />
      </div>

      <Panel title="Begonnen und abgebrochen" hint="je Modus">
        {funnel.starts_total === 0 ? (
          <p className="py-6 text-center text-small text-muted-foreground">
            Noch keine Daten. Gezählt wird ab dem ersten Rateversuch eines Spiels.
          </p>
        ) : (
          <>
            <BarRanking data={funnel.starts_by_mode} accent={2} labelMap={MODE_LABELS} />
            <p className="mt-3 text-micro text-muted-foreground">
              {formatNumber(funnel.abandoned_total)} Spiele wurden begonnen und nicht beendet.
              Duell und Koop melden keinen Start und bleiben hier außen vor.
            </p>
          </>
        )}
      </Panel>

      <Panel title="Teilen" hint="Klicks je Modus, Ankünfte je Seite">
        {sharing.shares_total === 0 && sharing.arrivals_total === 0 ? (
          <p className="py-6 text-center text-small text-muted-foreground">Noch nichts geteilt</p>
        ) : (
          <>
            <BarRanking data={sharing.shares_by_mode} accent={3} labelMap={MODE_LABELS} />
            <div className="mt-4">
              <BarRanking data={sharing.arrivals_by_page} accent={1} labelMap={PAGE_LABELS}
                emptyLabel="Noch keine Ankünfte" />
            </div>
            <p className="mt-3 text-micro text-muted-foreground">
              Der Klick auf „Teilen“ wird vom Browser gemeldet, die Ankunft am Link serverseitig
              gezählt. Ein Klick ist eine Absicht, kein Besuch.
            </p>
          </>
        )}
      </Panel>

      <Panel title="Aufmerksamkeit je Seite" hint="nur sichtbare Tabs" className="lg:col-span-2">
        {attention.seconds_total === 0 ? (
          <p className="py-6 text-center text-small text-muted-foreground">Noch keine Daten</p>
        ) : (
          <>
            <BarRanking
              data={Object.fromEntries(
                Object.entries(attention.seconds_by_page).map(([page, seconds]) => [
                  page,
                  Math.round(seconds / 60),
                ]),
              )}
              accent={4}
              labelMap={PAGE_LABELS}
            />
            <p className="mt-3 text-micro text-muted-foreground">
              Angaben in Minuten, gesamt {formatDuration(attention.seconds_total)}
              {pageviews > 0 && `, im Schnitt ${formatDuration(attention.seconds_total / pageviews)} je Seitenaufruf`}
              . Geschätzt aus Lebenszeichen im {attention.sample_seconds}-Sekunden-Takt, gezählt nur
              bei sichtbarem Tab.
            </p>
          </>
        )}
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
      <Panel title="Modus-Beliebtheit über Zeit" hint="abgeschlossene Spiele/Monat, nach Familie" className="lg:col-span-2">
        <StackedAreaTrend data={modeFamilyTrend(stats.mode_monthly)} series={MODE_SERIES} xKey="month" labelFormatter={shortMonth} />
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

function WordQualitySection({ stats }: SectionProps) {
  return <WordQuality stats={stats} />;
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
          <AccordionTrigger className="text-small">Datenerhebung & Hinweise</AccordionTrigger>
          <AccordionContent className="space-y-3 text-small text-muted-foreground">
            <p>{stats.note}</p>
            <ul className="space-y-1">
              <li>Herausgefilterte Bots: <span className="font-medium text-foreground">{formatNumber(stats.bots_filtered)}</span></li>
              <li>Duelle erstellt: <span className="font-medium text-foreground">
                {formatNumber(Object.values(stats.duels_created ?? {}).reduce((a, b) => a + b, 0))}</span>
                {Object.keys(stats.duels_created ?? {}).length > 0 && (
                  <span> ({Object.entries(stats.duels_created).map(([k, v]) =>
                    `${MODE_LABELS[k] ?? k}: ${formatNumber(v)}`).join(", ")})</span>
                )}
              </li>
              <li>Klebrigkeit (Tag/Monat): <span className="font-medium text-foreground">{formatPercent(stats.stickiness)}</span></li>
              <li>Rohdaten-Aufbewahrung: 35 Tage, danach nur aggregierte Werte.</li>
              <li>Stand: <span className="font-medium text-foreground">{formatStamp(stats.generated_at)}</span></li>
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
    id: "survey", group: "REICHWEITE", label: "Herkunft", icon: MessageCircleQuestion,
    title: "Woher kennen sie Kontexto?",
    description: "Selbst genannte Herkunft, freiwillig und ohne Besucherbezug",
    Component: SurveySection,
  },
  {
    id: "funnel", group: "REICHWEITE", label: "Trichter & Teilen", icon: Share2,
    title: "Trichter, Teilen und Aufmerksamkeit",
    description: "Wie viele anfangen, wie viel geteilt wird, wie lange gelesen wird",
    Component: FunnelSection,
  },
  {
    id: "ad-consent", group: "REICHWEITE", label: "Werbung", icon: Megaphone,
    title: "Werbe-Einwilligung",
    description: "Wie das Banner beantwortet wird, einmal je Besucher und Monat gezählt",
    Component: AdConsentSection,
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
    id: "word-quality", group: "SPIEL", label: "Wortqualität", icon: ThumbsUp,
    title: "Was die Spieler über die Wörter sagen",
    description: "Freiwillige Bewertung nach jeder Runde, ohne Besucherbezug",
    Component: WordQualitySection,
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
