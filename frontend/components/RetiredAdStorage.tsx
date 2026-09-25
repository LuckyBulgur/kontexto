"use client";

import { useEffect } from "react";
import { clearRetiredAdStorage } from "@/lib/retired-ad-storage";

/** Runs the one-time storage cleanup of `lib/retired-ad-storage.ts` once per page load. */
export default function RetiredAdStorage() {
  useEffect(() => {
    try {
      clearRetiredAdStorage(window.localStorage, window.sessionStorage);
    } catch {
      // Storage blocked: then nothing could have been written there either.
    }
  }, []);
  return null;
}
