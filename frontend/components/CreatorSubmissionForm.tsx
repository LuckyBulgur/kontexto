"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitCreatorClip } from "@/lib/api";

const errors: Record<string, string> = {
  invalid_url: "Bitte verlinke einen konkreten Clip und den zugehörigen Kanal auf TikTok, YouTube, Twitch oder Instagram.",
  platform_mismatch: "Clip und Kanal müssen auf derselben Plattform liegen.",
  invalid_name: "Bitte gib einen Kanalnamen mit 2 bis 80 Zeichen ein.",
  invalid_email: "Bitte prüfe die E-Mail-Adresse.",
  duplicate_clip: "Dieser Clip wurde bereits eingereicht.",
  rate_limited: "Du hast innerhalb von 24 Stunden schon drei Clips eingereicht. Versuche es später erneut.",
};

export default function CreatorSubmissionForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const values = new FormData(event.currentTarget);
    try {
      await submitCreatorClip({
        clip_url: String(values.get("clip_url") ?? ""),
        channel_url: String(values.get("channel_url") ?? ""),
        channel_name: String(values.get("channel_name") ?? ""),
        email: String(values.get("email") ?? ""),
      });
      setDone(true);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "";
      setError(errors[message] ?? "Einreichen fehlgeschlagen. Bitte versuche es später erneut.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-small text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Zurück zum Spiel</Link>
      <h1 className="mt-6 text-h2 font-bold">Zeig Kontexto in deinem Clip</h1>
      <p className="mt-3 text-body text-muted-foreground">Du spielst Kontexto in einem Short, Clip, Stream-Mitschnitt oder Video? Reiche es ein. Nach unserer Prüfung kann dein Kanal beim täglichen Rätsel vorgestellt werden.</p>

      <div className="mt-6 rounded-lg border bg-card p-4 text-small">
        <p className="font-semibold">Das muss zu sehen sein</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Im öffentlichen Video wird Kontexto tatsächlich gespielt.</li>
          <li>„Kontexto.de“ steht erkennbar im Video, Titel oder in der Beschreibung.</li>
          <li>Clip und Kanal liegen auf TikTok, YouTube, Twitch oder Instagram.</li>
        </ul>
        <p className="mt-3 text-muted-foreground">Du brauchst kein Werbevideo. Freigegebene Clips kommen nach Einreichungszeitpunkt an die Reihe. Ein Platz ist deshalb nicht für den nächsten Tag garantiert.</p>
      </div>

      {done ? (
        <div role="status" className="mt-6 rounded-lg border border-primary/40 p-4">
          <p className="font-semibold">Clip eingereicht</p>
          <p className="mt-1 text-small text-muted-foreground">Wir prüfen ihn von Hand. Bei einer Freigabe kommt dein Kanal in die Warteliste für ein kommendes Tagesrätsel.</p>
          <Button asChild variant="link" className="mt-2 px-0"><Link href="/">Zurück zum Spiel</Link></Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2"><Label htmlFor="clip_url">Link zum Clip oder Video</Label><Input id="clip_url" name="clip_url" type="url" required maxLength={500} placeholder="https://www.youtube.com/shorts/..." /></div>
          <div className="space-y-2"><Label htmlFor="channel_url">Link zu deinem Kanal</Label><Input id="channel_url" name="channel_url" type="url" required maxLength={500} placeholder="https://www.youtube.com/@deinkanal" /></div>
          <div className="space-y-2"><Label htmlFor="channel_name">Kanalname</Label><Input id="channel_name" name="channel_name" required minLength={2} maxLength={80} /></div>
          <div className="space-y-2"><Label htmlFor="email">E-Mail für Rückfragen (freiwillig)</Label><Input id="email" name="email" type="email" maxLength={254} autoComplete="email" /></div>
          <p className="text-micro text-muted-foreground">Mit dem Einreichen bestätigst du, dass wir deinen öffentlichen Kanalnamen und Kanallink für einen Spieltag anzeigen dürfen. Angaben zur Speicherung findest du in der <Link href="/datenschutz/" className="underline">Datenschutzerklärung</Link>.</p>
          {error && <p role="alert" className="text-small text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>{busy ? "Wird eingereicht…" : "Clip einreichen"}<Send className="size-4" /></Button>
        </form>
      )}
    </main>
  );
}
