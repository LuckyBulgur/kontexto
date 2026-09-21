import { Panel } from "@/components/design";
import { cn } from "@/lib/utils";

/**
 * How a round works, in one place.
 *
 * The home screen's empty state and the Spielanleitung dialog explained the
 * same three things in two different shapes: numbered steps here, prose there,
 * a colour legend as a panel here and as a bullet list there. Two shapes for
 * one explanation is two things to keep true, and they had already drifted.
 *
 * Server component with no hooks, so it can sit in a static page as easily as
 * in a dialog.
 */

/** The three steps of a round, in the order they actually happen. */
export const HOW_IT_WORKS = [
  { title: "Wort eingeben.", body: "Jedes deutsche Wort zählt, auch eines, das weit daneben liegt." },
  { title: "Rang ablesen.", body: "Rang 1 ist das gesuchte Wort. Je kleiner die Zahl, desto näher bist du." },
  { title: "Der Bedeutung folgen.", body: "Denk weiter in die Richtung, in der die Ränge kleiner werden." },
] as const;

export const RANK_LEGEND = [
  { dot: "bg-rank-near", label: "Grün", range: "Rang 1 bis 300", desc: "sehr nah am Zielwort" },
  { dot: "bg-rank-mid", label: "Gelb", range: "Rang 301 bis 1500", desc: "auf dem richtigen Weg" },
  { dot: "bg-rank-far", label: "Rot", range: "ab Rang 1501", desc: "noch weit entfernt" },
] as const;

/**
 * An ordered list, because the order is real: you cannot read a rank before you
 * have guessed, and you cannot follow the meaning before you have read one.
 */
export function HowToPlaySteps() {
  return (
    <ol className="flex flex-col gap-3">
      {HOW_IT_WORKS.map((step, i) => (
        <li key={step.title} className="flex gap-3">
          <span
            data-numeric
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-display text-micro font-bold text-primary-foreground"
            aria-hidden="true"
          >
            {i + 1}
          </span>
          <p className="text-small text-muted-foreground">
            <span className="font-semibold text-foreground">{step.title}</span> {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * The colour meaning. The dot is decorative; the range and the description
 * carry it in words, so it works without colour vision too.
 */
export function RankLegend({ className }: { className?: string }) {
  return (
    <Panel tone="quiet" padding="sm" className={cn("gap-2", className)}>
      {RANK_LEGEND.map((row) => (
        <div key={row.label} className="flex items-start gap-2.5">
          <span
            className={cn("mt-[0.45rem] inline-block h-2.5 w-2.5 shrink-0 rounded-full", row.dot)}
            aria-hidden="true"
          />
          <p className="text-small">
            <span className="font-semibold">{row.label}</span>{" "}
            <span className="text-muted-foreground">
              {row.range}, {row.desc}
            </span>
          </p>
        </div>
      ))}
    </Panel>
  );
}

/** Steps plus legend, the whole explanation. Used by the dialog and the page. */
export function HowToPlayBody() {
  return (
    <div className="flex flex-col gap-6">
      <HowToPlaySteps />
      <RankLegend />
      <p className="text-small text-muted-foreground">
        {"Kommst du nicht weiter, hol dir über das Menü einen Tipp. Wie nah ein Tipp liegt, stellst du unter Schwierigkeitsgrad ein. Jeden Tag um Mitternacht gibt es ein neues Wort."}
      </p>
    </div>
  );
}
