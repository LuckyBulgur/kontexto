import { useEffect, useSyncExternalStore } from "react";

/**
 * Whether a live board with its header is on screen, so the floating Ko-fi
 * button (`components/SupportHost.tsx`) can stand next to that header's menu.
 *
 * The path alone cannot say it: `/live/<id>/` is the board for the host and an
 * invited guest, but a landing without any header for everybody else. So the
 * board announces itself by rendering `<SupportBoardPin />`. A count rather than
 * a flag, because React may mount the next board before it unmounts the last.
 */

let mounted = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Rendered by the live board while its header stands; renders nothing. */
export function SupportBoardPin(): null {
  useEffect(() => {
    mounted += 1;
    emit();
    return () => {
      mounted -= 1;
      emit();
    };
  }, []);
  return null;
}

export function useSupportBoardPinned(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => mounted > 0,
    () => false,
  );
}
