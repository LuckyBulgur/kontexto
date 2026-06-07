"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { adminPasskeyLogin, getAdminStats } from "@/lib/api";
import type { StatsData } from "@/lib/types";
import StatsSkeleton from "@/components/admin/StatsSkeleton";

// Recharts (and all chart components) are loaded only when stats data is ready,
// keeping them out of the initial page bundle.
const Dashboard = dynamic(() => import("@/components/admin/StatsCharts"), {
  ssr: false,
  loading: () => <StatsSkeleton />,
});

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
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statistiken</h1>
          <p className="text-sm text-muted-foreground">Übersicht über Besucher und Spielverhalten</p>
        </div>
        <Button
          variant="outline"
          onClick={() => { sessionStorage.removeItem(TOKEN_KEY); setToken(null); setStats(null); }}
        >
          Abmelden
        </Button>
      </div>

      {loading && <StatsSkeleton />}
      {error && <p className="text-red-500">{error}</p>}
      {stats && <Dashboard stats={stats} />}
    </main>
  );
}

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true);
    setError(null);
    try {
      const token = await adminPasskeyLogin();
      onLogin(token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error";
      if (msg === "rate_limited") setError("Zu viele Versuche. Bitte warten.");
      else if (msg === "no_credential") setError("Kein Passkey registriert.");
      else setError("Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border p-6">
        <h1 className="text-xl font-bold">Admin-Login</h1>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button onClick={login} className="w-full" disabled={busy}>
          {busy ? "…" : "Mit Passkey anmelden"}
        </Button>
      </div>
    </main>
  );
}
