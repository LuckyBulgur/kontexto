import ChatIdentity from "@/components/live/ChatIdentity";
import {
  ACTIVITY_LABELS,
  ACTIVITY_ORDER,
  eventSentence,
  type LatestActivity as LatestActivityState,
} from "@/lib/live-events";
import type { LiveBadgeCatalog } from "@/lib/live-types";
import { cn } from "@/lib/utils";

/**
 * The newest follow, donation and sub, in the row above the guess input on the
 * live host page. A slot shows only once its category has an event: a room
 * that reads Twitch alone never gets a follow, and an empty slot there would
 * stand empty for the whole evening. The list sits flush right and every name
 * shrinks to an ellipsis before a label or a logo gives way; the full sentence
 * is the tooltip.
 */
export default function LatestActivity({
  latest,
  catalog,
  className,
}: {
  latest: LatestActivityState;
  catalog: LiveBadgeCatalog;
  className?: string;
}) {
  const slots = ACTIVITY_ORDER.flatMap((kind) => {
    const event = latest[kind];
    return event ? [{ kind, event }] : [];
  });
  if (slots.length === 0) return null;
  return (
    <ul
      aria-label="Letzte Aktivitäten"
      data-testid="live-latest-activity"
      className={cn("flex min-w-0 items-baseline justify-end gap-x-3", className)}
    >
      {slots.map(({ kind, event }) => (
        <li
          key={kind}
          data-activity={kind}
          title={eventSentence(event)}
          className="flex min-w-0 items-baseline gap-1"
        >
          <span className="shrink-0">{`${ACTIVITY_LABELS[kind]}:`}</span>
          <ChatIdentity
            name={event.actor}
            platform={event.platform}
            catalog={catalog}
            className="self-center"
            nameClassName="font-semibold text-foreground"
          />
        </li>
      ))}
    </ul>
  );
}
