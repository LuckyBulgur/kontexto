"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4 p-8">
        <h2 className="text-2xl font-bold">Etwas ist schiefgelaufen</h2>
        <p className="text-muted-foreground">
          Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
        </p>
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
