"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/design";
import { getSupporterQueue, reviewSupporter, type SupporterEntry } from "@/lib/api";
import { formatStamp } from "@/lib/format";

/** The reason codes of backend/supporters.py, worded for the operator. */
const REASONS: Record<string, string> = {
  unknown_word: "Kein bekannter Vor- oder Nachname",
  digits: "Enthält Zahlen",
  symbols: "Enthält Sonderzeichen",
  script: "Nicht-lateinische Schrift",
  shouting: "Nur Großbuchstaben",
  too_many_words: "Mehr als drei Wörter",
};

/**
 * The operator's say over the supporter rails. A name that is not plainly a
 * first or family name waits here and is public only after "Freigeben"; an
 * approved name can still be taken down. Refused names (insults, links, email
 * addresses) never reach this list, they are not stored at all.
 */
export default function SupporterReview({ token }: { token: string }) {
  const [pending, setPending] = useState<SupporterEntry[]>([]);
  const [approved, setApproved] = useState<SupporterEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getSupporterQueue(token);
      setPending(data.pending);
      setApproved(data.approved);
      setError(null);
    } catch {
      setError("Unterstützer konnten nicht geladen werden.");
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function decide(id: string, approve: boolean) {
    setBusy(id);
    try {
      await reviewSupporter(token, id, approve);
      await refresh();
    } catch {
      setError("Die Entscheidung konnte nicht gespeichert werden. Bitte neu laden.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel padding="sm" className="gap-3 sm:p-5" role="region" aria-labelledby="supporter-review-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="supporter-review-heading" className="text-small font-semibold text-foreground">
            Unterstützer prüfen
            {pending.length > 0 && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-micro text-primary-foreground">
                {pending.length} offen
              </span>
            )}
          </h3>
          <p className="text-small text-muted-foreground">
            Namen für die Danke-Leisten neben dem Spielfeld. Öffentlich ist nur, was freigegeben ist.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          Aktualisieren
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}

      <div className="divide-y">
        {pending.length === 0 && (
          <p className="py-4 text-center text-small text-muted-foreground">Nichts zu prüfen.</p>
        )}
        {pending.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-small">
            <div className="min-w-0">
              <p className="break-all font-semibold text-foreground">{row.name}</p>
              <p className="text-micro text-muted-foreground">
                {row.reason ? (REASONS[row.reason] ?? row.reason) : "Ohne Grund"}, {formatStamp(row.created_at)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy === row.id} onClick={() => void decide(row.id, true)}>
                Freigeben
              </Button>
              <Button size="sm" variant="outline" disabled={busy === row.id} onClick={() => void decide(row.id, false)}>
                Ablehnen
              </Button>
            </div>
          </div>
        ))}
      </div>

      {approved.length > 0 && (
        <details className="border-t pt-3 text-small">
          <summary className="cursor-pointer">Gerade sichtbar ({approved.length})</summary>
          <ul className="mt-2 divide-y">
            {approved.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                <span className="break-all">{row.name}</span>
                <Button size="sm" variant="outline" disabled={busy === row.id} onClick={() => void decide(row.id, false)}>
                  Ausblenden
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}
