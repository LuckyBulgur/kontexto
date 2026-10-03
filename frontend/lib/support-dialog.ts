import { useSyncExternalStore } from "react";
import { reportSupportOpen } from "@/lib/analytics";
import type { SupportSource } from "@/lib/support";

/**
 * One Ko-fi dialog for the whole page, opened from several places.
 *
 * A small external store rather than a React context, because the triggers sit
 * in unrelated trees (the layout's floating button, a result card inside a game
 * client) and a provider around both would have to wrap the layout's children.
 * The host (`components/SupportHost.tsx`) renders the one dialog.
 */

let open = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens the panel and counts where it was opened from. */
export function openSupport(source: SupportSource): void {
  void reportSupportOpen(source);
  if (open) return;
  open = true;
  emit();
}

export function closeSupport(): void {
  if (!open) return;
  open = false;
  emit();
}

export function useSupportOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
