import { SoloModeMeta } from "@/lib/solo-modes";
import { Panel } from "@/components/design";

/**
 * The rules of the active mode, shown until the first guess lands. The daily
 * game does the same thing with its own block; a new mode needs it more, because
 * nobody arrives already knowing what counts as losing here.
 */
export default function SoloRulesCard({ mode }: { mode: SoloModeMeta }) {
  return (
    <Panel className="gap-3 text-small text-muted-foreground">
      <h2 className="text-body font-semibold text-foreground">Die Regeln von {mode.name}</h2>
      <p>{mode.tagline}</p>
      <ul className="space-y-1.5 list-disc pl-5">
        {mode.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </Panel>
  );
}
