"use client";

// Responsive navigation for the admin stats dashboard. On large screens it is a
// vertical, grouped, sticky sidebar; on smaller screens it collapses into a
// horizontally scrollable pill bar. Purely presentational — it receives the
// grouped sections and the active id, and reports selections back up.

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatsNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface StatsNavGroup {
  title: string;
  items: StatsNavItem[];
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function StatsSidebar({
  groups,
  activeId,
  onSelect,
}: {
  groups: StatsNavGroup[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const flatItems = groups.flatMap((g) => g.items);

  return (
    <nav
      aria-label="Statistik-Bereiche"
      className="lg:sticky lg:top-8 lg:w-56 lg:shrink-0 lg:self-start"
    >
      {/* Mobile / tablet: horizontally scrollable pill bar */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
        {flatItems.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                FOCUS_RING,
                active
                  ? "border-transparent bg-secondary text-foreground shadow-sm"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Desktop: vertical grouped sidebar */}
      <div className="hidden lg:block lg:space-y-6">
        {groups.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                        FOCUS_RING,
                        active
                          ? "bg-secondary text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
