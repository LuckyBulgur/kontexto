"use client";

import { useSyncExternalStore } from "react";
import { readAdConsent, subscribeAdConsent, type AdConsentChoice } from "@/lib/ad-consent";

export type AdConsentSnapshot = AdConsentChoice | "unset" | "server";

const getSnapshot = (): AdConsentSnapshot => readAdConsent()?.choice ?? "unset";
const getServerSnapshot = (): AdConsentSnapshot => "server";

/**
 * The stored ad decision as React state. "server" during prerender and the
 * first hydration pass, so nothing ad-related is ever part of the static HTML.
 */
export function useAdConsent(): AdConsentSnapshot {
  return useSyncExternalStore(subscribeAdConsent, getSnapshot, getServerSnapshot);
}
