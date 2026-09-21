import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The name, set once.
 *
 * It used to appear four ways: tracked-out caps at 14px in the site nav and the
 * footer, tracked-out caps at 24px above the create forms, and mixed case in
 * the game header. A name that changes shape per page is not a name. One
 * component, one form, size by prop.
 *
 * The final o is drawn as a ring instead of typed. It is the only mark the
 * product carries, and it is not arbitrary: Kontexto is a game about closing in
 * on one hidden word, and a ring around an empty centre is that. It also gives
 * the accent colour a permanent home in the header, so a Farbwelt is visible
 * before anything else on the page has been read.
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
  const content = <WordmarkName name={name} />;
  if (!asLink) return <span className={classes}>{content}</span>;
  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}

/**
 * The name with its last letter drawn.
 *
 * The ring is sized in `em` so it tracks the font size wherever the wordmark is
 * used, and it sits on the text baseline rather than being centred, because a
 * geometric circle centred on the cap height reads as too high next to a
 * lowercase o.
 */
export function WordmarkName({ name }: { name: "Kontexto" | "Wördle" }) {
  // Only the main name ends in the letter the ring replaces; the Wordle
  // section keeps its own name typed as it is.
  if (name !== "Kontexto") return <>{name}</>;
  return (
    <>
      <span aria-hidden="true">Kontext</span>
      <span
        aria-hidden="true"
        className={cn(
          "ml-[0.06em] inline-block rounded-full border-[0.16em] border-primary align-baseline",
          "h-[0.52em] w-[0.52em] translate-y-[-0.02em]",
        )}
      />
      <span className="sr-only">Kontexto</span>
    </>
  );
}
