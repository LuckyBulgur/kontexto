/**
 * Kopiert Text in die Zwischenablage. Bevorzugt die asynchrone Clipboard-API
 * und fällt für unsichere Kontexte (kein HTTPS) oder ältere Browser auf das
 * Legacy-`execCommand`-Verfahren zurück. Gibt zurück, ob das Kopieren gelang –
 * die Aufrufstelle entscheidet über die (deutschsprachige) Nutzer-Rückmeldung.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard-API blockiert (z. B. fehlende Nutzergeste) – Fallback unten.
    }
  }

  if (typeof document === "undefined") return false;

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
