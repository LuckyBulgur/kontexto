"use client";

import { useEffect, useState } from "react";
import { getBeaconToken, submitRating } from "@/lib/api";

const STORAGE_KEY = "kontexto_rated";

export default function RatingPrompt() {
  // Start visible (for SSR / static export) and suppress once we know the user
  // has already rated. We use `null` as the "not yet hydrated" sentinel so the
  // widget is present in the static HTML and only vanishes client-side when
  // localStorage confirms a prior rating.
  const [rated, setRated] = useState<boolean>(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) {
      setRated(true);
    }
  }, []);

  if (rated) return null;

  async function handleRate(value: number) {
    setRated(true);
    localStorage.setItem(STORAGE_KEY, String(value));
    try {
      const token = await getBeaconToken();
      await submitRating(token, value);
    } catch {
      // Best-effort: rating is non-critical, never surface errors to the user.
    }
  }

  return (
    <div className="mt-8 flex flex-col items-start gap-2">
      <p className="text-sm font-medium text-foreground">Gefällt dir Kontexto?</p>
      <div
        role="group"
        aria-label="Kontexto bewerten"
        className="flex gap-1"
      >
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            aria-label={`${v} Sterne`}
            onClick={() => handleRate(v)}
            className="text-2xl leading-none transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
