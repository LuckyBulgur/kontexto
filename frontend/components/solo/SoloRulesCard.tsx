import { SoloModeMeta } from "@/lib/solo-modes";

/**
 * The rules of the active mode, shown until the first guess lands. The daily
 * game does the same thing with its own block; a new mode needs it more, because
 * nobody arrives already knowing what counts as losing here.
 */
export default function SoloRulesCard({ mode }: { mode: SoloModeMeta }) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3 text-sm text-muted-foreground">
      <h2 className="text-base font-semibold text-foreground">Die Regeln von {mode.name}</h2>
      <p>{mode.tagline}</p>
      <ul className="space-y-1.5 list-disc pl-5">
        {mode.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </div>
  );
}
