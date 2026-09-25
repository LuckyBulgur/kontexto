"use client";

import { Award, Gamepad2, MessageCircleQuestion, Type } from "lucide-react";
import type { StatsData, WordRatingEntry } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { KpiCard, Panel } from "@/components/admin/charts";

/**
 * Word quality: what the players say about the solution words.
 *
 * Its own file rather than a tenth section inside StatsCharts, which already
 * carries nine and seven hundred lines.
 *
 * Coverage stands first and not as a footnote. Only a word that ran as the daily
 * puzzle collects a usable sample, so without that number the tables below read
 * as if they described the pool, when they describe a few dozen words of 2.710.
 *
 * The removal list ranks on "did not know the word", never on "too hard". That
 * difference is the whole reason the second question is asked at all: a long
 * round is already visible in the guess count, a word nobody knew is visible
 * nowhere else.
 */

/** All visible copy in one place, the convention SourceSurvey and WordRating
 *  already follow. */
const COPY = {
  title: "Wortqualität",
  empty: "Noch keine Bewertungen. Die Frage erscheint auf der Ergebniskarte jeder beendeten Runde.",
  votes: "Stimmen",
  ratedWords: "Bewertete Wörter",
  ratedWordsSub: (pool: string, share: string) => `von ${pool} im Pool, ${share}`,
  tooHard: "Zu schwer",
  tooHardSub: (min: number) => `ab ${min} Stimmen je Wort`,
  unknownShare: "Davon unbekannt",
  unknownShareSub: "der Grund, der ein Wort aus dem Pool nimmt",
  removalTitle: "Kandidaten zum Streichen",
  removalHint: "Anteil „Wort nicht gekannt“",
  removalNote:
    "Ein hoher Anteil hier heißt: das Wort kennt kaum jemand. Ein langer Rateweg allein steht "
    + "schon in der Zügezahl und ist kein Grund zu streichen.",
  easyTitle: "Zu leicht bewertet",
  easyHint: "Beleg, das Band zu öffnen",
  easyNote: "Zeigen diese Wörter ein Muster, können ähnliche in den Pool.",
  agreementTitle: "Stimmt die Note mit dem Spiel überein?",
  agreementHint: "Bewertung gegen Rateversuche",
  agreementNote:
    "Sagt die Bewertung nur, was die Zügezahl schon sagt, dann zählt allein die Begründung.",
  detailsTitle: "Freitexte",
  detailsHint: "neueste zuerst",
  noDetails: "Noch keine Freitexte",
  noRows: "Noch kein Wort mit genug Stimmen",
  columnWord: "Wort",
  columnShare: "Anteil",
  columnVotes: "Stimmen",
};

const VERDICT_LABELS: Record<string, string> = {
  easy: "zu leicht",
  right: "genau richtig",
  hard: "zu schwer",
};

const REASON_LABELS: Record<string, string> = {
  unknown_word: "Wort nicht gekannt",
  no_idea: "kam nicht drauf",
  bad_neighbours: "Nähe ergab keinen Sinn",
};

/** A share always stands next to its vote count, because a share without its
 *  base is how a thin sample gets mistaken for a finding. */
function RatingTable({ rows, share, accent }: {
  rows: WordRatingEntry[];
  share: (entry: WordRatingEntry) => number;
  accent: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-small text-muted-foreground">{COPY.noRows}</p>;
  }
  return (
    <div className="max-h-96 overflow-y-auto">
      <table className="w-full text-small">
        <thead className="sticky top-0 bg-card text-micro text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 pr-2 text-left font-normal">{COPY.columnWord}</th>
            <th className="py-1 pr-2 text-right font-normal">{COPY.columnShare}</th>
            <th className="py-1 text-right font-normal">{COPY.columnVotes}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <tr key={entry.word} className="border-b last:border-0">
              <td className="py-2 pr-2">
                <span className="font-medium">{entry.word}</span>
                <span className="ml-2 text-micro text-muted-foreground" data-numeric>
                  {`#${entry.game_number}`}
                </span>
              </td>
              <td className="py-2 pr-2 text-right" data-numeric>
                <span className={accent}>{formatPercent(share(entry))}</span>
              </td>
              <td className="py-2 text-right text-muted-foreground" data-numeric>{entry.votes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WordQuality({ stats }: { stats: StatsData }) {
  const ratings = stats.word_ratings;

  if (!ratings || ratings.votes_total === 0) {
    return (
      <Panel title={COPY.title}>
        <p className="py-6 text-center text-small text-muted-foreground">{COPY.empty}</p>
      </Panel>
    );
  }

  const coverage = ratings.pool_size > 0 ? ratings.words_rated / ratings.pool_size : 0;
  const hardShare = ratings.votes_total > 0 ? ratings.verdicts.hard / ratings.votes_total : 0;
  const unknownOfHard = ratings.verdicts.hard > 0
    ? ratings.reasons.unknown_word / ratings.verdicts.hard
    : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-2">
        <KpiCard icon={MessageCircleQuestion} accent={0} label={COPY.votes}
          value={formatNumber(ratings.votes_total)} />
        <KpiCard icon={Type} accent={2} label={COPY.ratedWords}
          value={formatNumber(ratings.words_rated)}
          sub={COPY.ratedWordsSub(formatNumber(ratings.pool_size), formatPercent(coverage))} />
        <KpiCard icon={Gamepad2} accent={3} label={COPY.tooHard}
          value={formatPercent(hardShare)} sub={COPY.tooHardSub(ratings.min_votes)} />
        <KpiCard icon={Award} accent={4} label={COPY.unknownShare}
          value={formatPercent(unknownOfHard)} sub={COPY.unknownShareSub} />
      </div>

      <Panel title={COPY.removalTitle} hint={COPY.removalHint} className="lg:col-span-2">
        <p className="mb-3 text-micro text-muted-foreground">{COPY.removalNote}</p>
        <RatingTable rows={ratings.removal_candidates} share={(e) => e.share_unknown}
          accent="text-destructive" />
      </Panel>

      <Panel title={COPY.easyTitle} hint={COPY.easyHint}>
        <p className="mb-3 text-micro text-muted-foreground">{COPY.easyNote}</p>
        <RatingTable rows={ratings.too_easy} share={(e) => e.share_easy} accent="text-foreground" />
      </Panel>

      <Panel title={COPY.agreementTitle} hint={COPY.agreementHint}>
        <p className="mb-3 text-micro text-muted-foreground">{COPY.agreementNote}</p>
        <RatingTable
          rows={[...ratings.rated].sort((a, b) => b.share_hard - a.share_hard).slice(0, 20)}
          share={(e) => e.share_hard} accent="text-foreground" />
      </Panel>

      <Panel title={COPY.detailsTitle} hint={COPY.detailsHint} className="lg:col-span-2">
        {ratings.details.length === 0 ? (
          <p className="py-6 text-center text-small text-muted-foreground">{COPY.noDetails}</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {ratings.details.map((entry, index) => (
              <li key={`${entry.word}-${index}`}
                className="border-b pb-2 last:border-0 last:pb-0">
                <p className="text-small">{entry.detail}</p>
                <p className="text-micro text-muted-foreground">
                  {[
                    entry.word,
                    VERDICT_LABELS[entry.verdict] ?? entry.verdict,
                    entry.reason ? REASON_LABELS[entry.reason] ?? entry.reason : null,
                    entry.date,
                  ].filter(Boolean).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
