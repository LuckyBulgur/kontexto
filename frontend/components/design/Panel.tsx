import * as React from "react";
import { Slot } from "radix-ui";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The project's one surface.
 *
 * Before this existed, 31 files each wrote their own `rounded-xl border bg-card
 * p-5`, while the real `Card` was used three times. Every surface therefore had
 * the same shape, and shape carried no meaning. A Panel has three tones and two
 * paddings, and nothing else, so a difference on screen is always a difference
 * that was chosen.
 *
 * Elevation rule, the only one: a panel is a fill plus a hairline and carries no
 * shadow. An overlay (dialog, popover, tooltip) carries a shadow and no border.
 * Depth in light mode comes from `--card` being lighter than `--background`.
 */

export type PanelTone = "card" | "quiet" | "accent";
export type PanelPadding = "none" | "sm" | "md";

const TONE: Record<PanelTone, string> = {
  /** The default: a panel lying on the page. */
  card: "border-border bg-card text-card-foreground",
  /** A recessed note inside another panel. No hairline, or it reads as nesting. */
  quiet: "border-transparent bg-muted text-foreground",
  /** The one thing on the screen that should be looked at first. */
  accent: "border-transparent bg-accent text-accent-foreground",
};

const PADDING: Record<PanelPadding, string> = {
  none: "p-0 py-0",
  sm: "gap-4 p-4 py-4",
  md: "gap-6 p-5 py-5",
};

export interface PanelProps extends React.ComponentProps<"div"> {
  tone?: PanelTone;
  padding?: PanelPadding;
  /** Renders the single child as the panel, for a semantic `ul`, `li` or `nav`. */
  asChild?: boolean;
}

export function Panel({
  tone = "card",
  padding = "md",
  asChild,
  className,
  ...props
}: PanelProps) {
  const classes = cn("rounded-xl", TONE[tone], PADDING[padding], className);
  if (asChild) {
    return (
      <Slot.Root
        data-slot="card"
        data-tone={tone}
        className={cn("flex flex-col border text-card-foreground", classes)}
        {...props}
      />
    );
  }
  return <Card data-tone={tone} className={classes} {...props} />;
}

type Level = "h1" | "h2" | "h3" | "h4";

export interface PanelHeaderProps {
  title: React.ReactNode;
  /** Heading level. Pick it from the page outline, never from the wanted size. */
  as?: Level;
  /** One sentence at most. If it needs two, it is body copy, not a description. */
  description?: React.ReactNode;
  /** A button or link pinned to the right of the title. */
  action?: React.ReactNode;
  className?: string;
}

const SIZE: Record<Level, string> = {
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
  h4: "text-lead font-semibold",
};

/**
 * Title plus optional description, with the gap between them fixed. Related
 * lines sit at `gap-1`, unrelated groups at `gap-6`; that difference is what
 * tells a reader where to start.
 */
export function PanelHeader({
  title,
  as = "h2",
  description,
  action,
  className,
}: PanelHeaderProps) {
  const Heading = as;
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <Heading className={cn("min-w-0 text-balance", SIZE[as])}>{title}</Heading>
        {description ? (
          <p className="text-small text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
