"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminPasskeyRegister } from "@/lib/api";

// Break-glass passkey enrollment. Only works while the server has
// KONTEXTO_ADMIN_ENROLL_TOKEN set (normally unset = enrollment disabled).
// Registering replaces any existing passkey (single passkey / single device).
export default function AdminEnrollPage() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function register() {
    setBusy(true);
    setStatus("idle");
    setMessage(null);
    try {
      await adminPasskeyRegister(token.trim());
      setStatus("ok");
      setMessage("Passkey registriert. Du kannst dich jetzt unter /admin/stats anmelden.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error";
      setStatus("error");
      setMessage(msg === "forbidden" ? "Registrierung gesperrt oder Token falsch." : "Registrierung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border p-6">
        <h1 className="text-xl font-bold">Passkey registrieren</h1>
        <Input
          aria-label="Enroll-Token"
          type="password"
          placeholder="Enroll-Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoFocus
        />
        {message && (
          <p className={`text-sm ${status === "ok" ? "text-green-600" : "text-red-500"}`}>{message}</p>
        )}
        <Button onClick={register} className="w-full" disabled={busy || !token.trim()}>
          {busy ? "…" : "Passkey registrieren"}
        </Button>
      </div>
    </main>
  );
}
