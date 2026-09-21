import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The name, set once.
 *
 * It used to appear four ways: tracked-out caps at 14px in the site nav and the
 * footer, tracked-out caps at 24px above the create forms, and mixed case in
 * the game header. A name that changes shape per page is not a name. One
 * component, one form, size by prop.
 */
export function Wordmark({
  size = "sm",
  name = "Kontexto",
  href = "/",
  className,
  asLink = true,
}: {
  size?: "sm" | "md";
  /** "Wördle" inside the Wördle section, which is its own product surface. */
  name?: "Kontexto" | "Wördle";
  href?: string;
  className?: string;
  /** False inside a header that is already one big link. */
  asLink?: boolean;
}) {
  const classes = cn(
    "font-display font-extrabold tracking-tight text-foreground",
    size === "md" ? "text-h3" : "text-body",
    className,
  );
  if (!asLink) return <span className={classes}>{name}</span>;
  return (
    <Link href={href} className={classes}>
      {name}
    </Link>
  );
}
