"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Coffee } from "lucide-react";
import { Panel } from "@/components/design";
import { getSupporters } from "@/lib/api";
import { SUPPORT_COPY, isSupportPinnedPage, splitSupporterRails } from "@/lib/support";

/**
 * The people who supported Kontexto on Ko-fi in the last 30 days, by name, in
 * the two gutters beside the board, where other sites run banner ads.
 *
 * Only on the single-column game pages, and only from `xl`: at 1280 pixels each
 * gutter is 24rem, enough for a 13rem rail with room to breathe; below that the
 * gutters are too narrow and the list is simply not there. The rails start
 * under the header row, because the support button sits right of the menu.
 * Absolute rather than fixed, so they scroll away with the top of the page and
 * never lie over the footer.
 *
 * Names only, never an amount, so nothing ranks one giver over another (the
 * player's decision). Before the first supporter, the left rail carries a quiet
 * line saying what will stand there, and no button: the rails thank, they do
 * not ask. A failed fetch shows nothing at all, not the empty line, because
 * "nobody yet" would then be a guess.
 */
export default function SupporterRails() {
  const pathname = usePathname();
  const shown = isSupportPinnedPage(pathname);
  const [names, setNames] = useState<string[] | null>(null);

  useEffect(() => {
    if (!shown) return;
    let alive = true;
    getSupporters()
      .then((list) => {
        if (alive) setNames(list);
      })
      .catch(() => {
        if (alive) setNames(null);
      });
    return () => {
      alive = false;
    };
  }, [shown]);

  if (!shown || names === null) return null;

  const { left, right, more } = splitSupporterRails(names);

  return (
    <>
      <aside
        aria-label={SUPPORT_COPY.railTitle}
        data-testid="supporter-rail-left"
        className="absolute top-24 right-[calc(50%+18rem)] hidden w-52 xl:block"
      >
        <Panel tone="quiet" padding="sm" className="gap-2">
          <p className="flex items-center gap-1.5 text-small font-semibold text-foreground">
            <Coffee className="h-4 w-4 text-primary" aria-hidden="true" />
            {SUPPORT_COPY.railTitle}
          </p>
          {left.length === 0 ? (
            <p className="text-small text-muted-foreground">{SUPPORT_COPY.railEmpty}</p>
          ) : (
            <NameList names={left} />
          )}
        </Panel>
      </aside>
      {right.length > 0 && (
        <aside
          aria-label={SUPPORT_COPY.railTitle}
          data-testid="supporter-rail-right"
          className="absolute top-24 left-[calc(50%+18rem)] hidden w-52 xl:block"
        >
          <Panel tone="quiet" padding="sm" className="gap-2">
            <NameList names={right} />
            {more > 0 && <p className="text-micro text-muted-foreground">{SUPPORT_COPY.railMore(more)}</p>}
          </Panel>
        </aside>
      )}
    </>
  );
}

function NameList({ names }: { names: string[] }) {
  return (
    <ul className="space-y-1 text-small text-muted-foreground">
      {names.map((name) => (
        <li key={name} className="truncate" title={name}>
          {name}
        </li>
      ))}
    </ul>
  );
}
