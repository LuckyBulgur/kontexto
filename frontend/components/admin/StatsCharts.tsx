"use client";

// Dashboard component containing all recharts-based charts for the admin stats
// page. Extracted so next/dynamic can lazy-load it (and recharts with it) only
// when the chart section is actually rendered.

import {
  Activity, Eye, Gamepad2, Lightbulb, Repeat, Sparkles,
  Target, Trophy, Type, Users, Wrench,
} from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AreaTrend, BarRanking, DonutChart, Heatmap, Histogram, KpiCard, Panel, SectionHeader,
} from "@/components/admin/charts";
import { formatDecimal, formatNumber, formatPercent, fullDate, trend } from "@/lib/format";
import type { GameDifficultyEntry, StatsData } from "@/lib/types";

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

export default function Dashboard({ stats }: { stats: StatsData }) {
  const e = stats.engagement;
  const dist = stats.distributions ?? {};
  const pageviewsTotal = Object.values(stats.pageviews_by_page).reduce((a, b) => a + b, 0);
  const finishedGames = e.solves_total + e.reveals_total;
  const loyaltyTotal = stats.visitor_loyalty.new + stats.visitor_loyalty.returning;
  const returningRate = loyaltyTotal ? stats.visitor_loyalty.returning / loyaltyTotal : null;

  const vt = stats.visitors_timeline;
  const visitorsTrend = vt.length >= 2 ? trend(vt[vt.length - 1].value, vt[vt.length - 2].value) : null;
  const gt = stats.guesses_timeline;
  const guessesTrend = gt.length >= 2 ? trend(gt[gt.length - 1].value, gt[gt.length - 2].value) : null;

  return (
    <div className="space-y-12">
      {/* --- Überblick ------------------------------------------------------ */}
      <section className="space-y-4">
        <SectionHeader icon={Sparkles} title="Überblick" description="Die wichtigsten Kennzahlen auf einen Blick" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <KpiCard icon={Users} accent={0} label="Besucher heute" value={formatNumber(stats.visitors.today)}
            sub={`Woche: ${formatNumber(stats.visitors.week)} · Monat: ${formatNumber(stats.visitors.month)}`}
            trend={visitorsTrend} spark={vt} />
          <KpiCard icon={Eye} accent={1} label="Seitenaufrufe (30 T)" value={formatNumber(pageviewsTotal)}
            spark={stats.pageviews_timeline} />
          <KpiCard icon={Gamepad2} accent={2} label="Rateversuche heute" value={formatNumber(stats.counters_today.guesses ?? 0)}
            sub={`gesamt: ${formatNumber(e.guesses_total)}`} trend={guessesTrend} spark={gt} />
          <KpiCard icon={Trophy} accent={3} label="Lösungen" value={formatNumber(e.solves_total)}
            sub={`abgeschlossen: ${formatNumber(finishedGames)}`} />
          <KpiCard icon={Target} accent={4} label="Lösungsrate" value={formatPercent(e.solve_rate)} />
          <KpiCard icon={Activity} accent={0} label="Ø Versuche/Lösung" value={formatDecimal(e.avg_guesses_per_solve)} />
          <KpiCard icon={Lightbulb} accent={3} label="Tipps genutzt" value={formatNumber(e.hints_total)} />
          <KpiCard icon={Repeat} accent={1} label="Wiederkehrer" value={formatPercent(returningRate)}
            sub={`${formatNumber(stats.visitor_loyalty.returning)} von ${formatNumber(loyaltyTotal)}`} />
        </div>
      </section>

      {/* --- Besucher & Reichweite ----------------------------------------- */}
      <section className="space-y-4">
        <SectionHeader icon={Users} title="Besucher & Reichweite" description="Woher sie kommen und wann sie da sind" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Unique-Besucher – letzte 30 Tage">
            <AreaTrend data={stats.visitors_timeline} accent={0} />
          </Panel>
          <Panel title="Seitenaufrufe – letzte 30 Tage">
            <AreaTrend data={stats.pageviews_timeline} accent={1} />
          </Panel>
          <Panel title="Geräte"><DonutChart data={stats.devices} labelMap={DEVICE_LABELS} /></Panel>
          <Panel title="Browser"><DonutChart data={stats.browsers} /></Panel>
          <Panel title="Beliebteste Seiten">
            <BarRanking data={stats.pageviews_by_page} accent={1} labelMap={PAGE_LABELS} />
          </Panel>
          <Panel title="Woher kommen die Besucher?">
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
            <AreaTrend data={stats.guesses_timeline} accent={2} />
          </Panel>
          <Panel title="Lösungsrate-Trend">
            <AreaTrend data={stats.solve_rate_timeline} accent={3} valueFormatter={(v) => formatPercent(Number(v))} />
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
