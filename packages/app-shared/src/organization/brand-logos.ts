"use client";

/**
 * Uploaded organization logos for the shell (sidebar, login). Read from the public
 * brand-logos endpoint and remembered in localStorage, so the login page shows the right
 * logo on the first paint of the next visit. Null = use the built-in Ejadah mark.
 */

import { useSyncExternalStore } from "react";
import {
  BRAND_IDENTITY_DEFAULTS,
  customBrandLogoUrl,
  getOrganizationBrandLogos,
} from "@platform/api-client";

export type BrandLogos = { color: string | null; white: string | null };

const STORAGE_KEY = "ree-brand-logos";
const EMPTY: BrandLogos = { color: null, white: null };

let current: BrandLogos | null = null;
let requested = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function readStored(): BrandLogos {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<BrandLogos>;
    return {
      color: typeof parsed.color === "string" ? parsed.color : null,
      white: typeof parsed.white === "string" ? parsed.white : null,
    };
  } catch {
    return EMPTY;
  }
}

function snapshot(): BrandLogos {
  if (current === null) current = typeof window === "undefined" ? EMPTY : readStored();
  return current;
}

function publish(next: BrandLogos): void {
  current = next;
  try {
    if (next.color || next.white) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* storage full or blocked — the in-memory copy still serves this tab */
  }
  listeners.forEach((listener) => listener());
}

/** Re-read the logos (after the brand identity screen saves one). */
export function refreshBrandLogos(): Promise<void> {
  if (inflight) return inflight;
  inflight = getOrganizationBrandLogos()
    .then((dto) => {
      if (!dto) return;
      const next: BrandLogos = {
        color: customBrandLogoUrl(dto.logoColorUrl, BRAND_IDENTITY_DEFAULTS.logoColorUrl),
        white: customBrandLogoUrl(dto.logoWhiteUrl, BRAND_IDENTITY_DEFAULTS.logoWhiteUrl),
      };
      const prev = snapshot();
      if (prev.color !== next.color || prev.white !== next.white) publish(next);
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!requested) {
    requested = true;
    void refreshBrandLogos();
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useBrandLogos(): BrandLogos {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
