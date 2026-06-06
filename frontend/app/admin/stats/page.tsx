"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminLogin, getAdminStats } from "@/lib/api";
import type { StatsData, TimelinePoint } from "@/lib/types";

const TOKEN_KEY = "kontexto_admin_token";

export default function AdminStatsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getAdminStats(token)
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((e) => {
        if (e.message === "unauthorized") {
          sessionStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
        setError("Statistiken konnten nicht geladen werden.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (!token) {
    return <LoginForm onLogin={(t) => { sessionStorage.setItem(TOKEN_KEY, t); setToken(t); }} />;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Statistiken</h1>
        <Button
          variant="outline"
          onClick={() => { sessionStorage.removeItem(TOKEN_KEY); setToken(null); setStats(null); }}
        >
          Abmelden
        </Button>
      </div>

      {loading && <p className="text-muted-foreground">Lädt…</p>}
      {error && <p className="text-red-500">{error}</p>}
      {stats && <Dashboard stats={stats} />}
    </main>
  );
}

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const token = await adminLogin(code.trim());
      onLogin(token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error";
      setError(msg === "rate_limited" ? "Zu viele Versuche. Bitte warten." : "Code ungültig.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border p-6">
        <h1 className="text-xl font-bold">Admin-Login</h1>
        <Input
          id="code"
          aria-label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !code.trim()}>
          {busy ? "Prüfe…" : "Anmelden"}
        </Button>
      </form>
    </main>
  );
}

function Dashboard({ stats }: { stats: StatsData }) {
  const e = stats.engagement;
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Unique User heute" value={stats.visitors.today} />
        <Stat label="Diese Woche" value={stats.visitors.week} />
        <Stat label="Diesen Monat" value={stats.visitors.month} />
        <Stat label="Guesses gesamt" value={e.guesses_total} />
        <Stat label="Guesses heute" value={stats.counters_today.guesses ?? 0} />
        <Stat label="Lösungen" value={e.solves_total} />
        <Stat label="Lösungsrate" value={e.solve_rate != null ? `${Math.round(e.solve_rate * 100)}%` : "–"} />
        <Stat label="Ø Guesses/Lösung" value={e.avg_guesses_per_solve ?? "–"} />
      </section>

      <Panel title="Unique User – letzte 30 Tage">
        <LineChart points={stats.visitors_timeline} />
      </Panel>

      <Panel title="Guesses pro Tag – letzte 30 Tage">
        <LineChart points={stats.guesses_timeline} color="#16a34a" />
      </Panel>

      <div className="grid gap-8 md:grid-cols-2">
        <Panel title="Seitenaufrufe je Seite">
          <BarList data={stats.pageviews_by_page} />
        </Panel>
        <Panel title="Spiele je Modus (abgeschlossen)">
          <BarList data={stats.games_by_mode} />
        </Panel>
        <Panel title="Top geratene Wörter">
          <BarList data={Object.fromEntries(stats.top_words.map((w) => [w.word, w.count]))} />
        </Panel>
        <Panel title="Engagement">
          <BarList data={{
            Lösungen: e.solves_total,
            Aufgegeben: e.reveals_total,
            "Tipps genutzt": e.hints_total,
          }} />
        </Panel>
        <Panel title="Geräte">
          <BarList data={stats.devices} />
        </Panel>
        <Panel title="Browser">
          <BarList data={stats.browsers} />
        </Panel>
        <Panel title="Referrer (Top 15)">
          <BarList data={stats.referrers} empty="Keine externen Referrer" />
        </Panel>
        <Panel title="Spitzenzeiten (Stunde, UTC)">
          <BarList data={stats.peak_hours} />
        </Panel>
      </div>

      <p className="text-xs text-muted-foreground">
        {stats.note} Bots herausgefiltert: {stats.bots_filtered}. Stand:{" "}
        {new Date(stats.generated_at).toLocaleString("de-DE")}.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function BarList({ data, empty = "Keine Daten" }: { data: Record<string, number>; empty?: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="space-y-1.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 truncate" title={key}>{key}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded bg-primary/70"
              style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ points, color = "#2563eb" }: { points: TimelinePoint[]; color?: string }) {
  if (points.length === 0) return <p className="text-sm text-muted-foreground">Noch keine Daten</p>;
  const w = 600, h = 140, pad = 8;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = points.length > 1 ? (w - 2 * pad) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = h - pad - (p.value / max) * (h - 2 * pad);
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        <path d={path} fill="none" stroke={color} strokeWidth={2} />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2} fill={color} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{points[0]?.date.slice(5)}</span>
        <span>Max: {max}</span>
        <span>{points[points.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}
