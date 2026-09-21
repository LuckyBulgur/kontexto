import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Info, Lightbulb, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const calloutVariants = cva("my-6 flex gap-3 rounded-lg border p-4 text-small", {
  variants: {
    variant: {
      info: "border-info/30 bg-info/5",
      tip: "border-success/30 bg-success/5",
      warning: "border-warning/40 bg-warning/5",
    },
  },
  defaultVariants: { variant: "info" },
});

const icons = { info: Info, tip: Lightbulb, warning: TriangleAlert } as const;
const iconColor = {
  info: "text-info-ink",
  tip: "text-success-ink",
  warning: "text-warning-ink",
} as const;

type Variant = NonNullable<VariantProps<typeof calloutVariants>["variant"]>;

/** Highlighted note box (info / tip / warning). Line icons, never emoji. */
export default function Callout({
  variant = "info",
  title,
  children,
}: {
  variant?: Variant;
  title?: string;
  children: ReactNode;
}) {
  const Icon = icons[variant];
  return (
    <div className={calloutVariants({ variant })}>
      <Icon className={cn("mt-0.5 size-5 shrink-0", iconColor[variant])} aria-hidden="true" />
      <div className="space-y-1">
        {title && <p className="font-semibold text-foreground">{title}</p>}
        <div className="leading-7 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_strong]:text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}
