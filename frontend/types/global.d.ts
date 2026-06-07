// Ambient-Typ für die von adsbygoogle.js injizierte Befehls-Queue.
export {};

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
    // Googles CMP / Funding Choices – nur vorhanden, wenn eine Datenschutz-
    // Nachricht im AdSense-Dashboard veröffentlicht ist.
    googlefc?: {
      showRevocationMessage?: () => void;
      callbackQueue?: { push: (callback: () => void) => void };
    };
  }
}
