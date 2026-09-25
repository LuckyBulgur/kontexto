"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCreatorSubmissions, reviewCreatorSubmission, type CreatorSubmission } from "@/lib/api";

const labels = { pending: "Offen", approved: "Freigegeben", rejected: "Abgelehnt", shown: "Angezeigt" };

export default function CreatorSubmissions({ token }: { token: string }) {
  const [rows, setRows] = useState<CreatorSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try { setRows(await getCreatorSubmissions(token)); setError(null); }
    catch { setError("Einreichungen konnten nicht geladen werden."); }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function review(id: number, approve: boolean) {
    setBusy(id);
    try { await reviewCreatorSubmission(token, id, approve); await refresh(); }
    catch { setError("Entscheidung konnte nicht gespeichert werden. Bitte neu laden."); }
    finally { setBusy(null); }
  }

  const active = rows.filter((row) => row.status === "pending" || row.status === "approved").sort((a, b) => a.id - b.id);
  const history = rows.filter((row) => row.status === "shown" || row.status === "rejected");

  return (
    <section className="mb-8 rounded-xl border p-4" aria-labelledby="creator-heading">
      <div className="flex items-center justify-between gap-3">
        <div><h2 id="creator-heading" className="text-h3 font-semibold">Creator-Clips</h2><p className="text-small text-muted-foreground">Einreichungen nach Eingangsreihenfolge prüfen. Freigegebene Clips kommen ab dem nächsten Tagesrätsel in die Warteliste.</p></div>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>Aktualisieren</Button>
      </div>
      {error && <p role="alert" className="mt-3 text-small text-destructive">{error}</p>}
      <div className="mt-4 space-y-3">
        {active.length === 0 && <p className="text-small text-muted-foreground">Keine offenen oder freigegebenen Clips.</p>}
        {active.map((row) => (
          <div key={row.id} className="rounded-lg border p-3 text-small">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><strong>#{row.id} · {row.channel_name}</strong><span>{row.platform}</span><span className="text-muted-foreground">{labels[row.status]}</span><span className="text-muted-foreground">Eingang: {row.submitted_at}</span></div>
            <div className="mt-2 flex flex-wrap gap-3"><a href={row.clip_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Clip öffnen</a><a href={row.channel_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Kanal öffnen</a>{row.email && <a href={`mailto:${row.email}`} className="text-primary underline">E-Mail</a>}</div>
            {row.status === "pending" && <div className="mt-3 flex gap-2"><Button size="sm" disabled={busy === row.id} onClick={() => void review(row.id, true)}>Freigeben</Button><Button size="sm" variant="outline" disabled={busy === row.id} onClick={() => void review(row.id, false)}>Ablehnen</Button></div>}
          </div>
        ))}
      </div>
      {history.length > 0 && <details className="mt-4 text-small"><summary className="cursor-pointer">Zuletzt bearbeitet ({history.length})</summary><ul className="mt-2 space-y-1">{history.slice(0, 30).map((row) => <li key={row.id}>#{row.id} · {row.channel_name} · {labels[row.status]}</li>)}</ul></details>}
    </section>
  );
}
