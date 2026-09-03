"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useAuthSession } from "@platform/app-shared/auth/use-auth-session";

const STORAGE_PREFIX = "ejada.favorite-properties.v1";
export const FAVORITE_PROPERTIES_CHANGED_EVENT =
  "favorite-properties-changed";

export type FavoritePropertyRef = {
  poNumber: string;
  propertyId: string;
  addedAtUtc: string;
};

const EMPTY_FAVORITES: readonly FavoritePropertyRef[] = [];
const snapshots = new Map<
  string,
  { raw: string | null; value: readonly FavoritePropertyRef[] }
>();

function storageKey(userId: string | null | undefined): string {
  return `${STORAGE_PREFIX}:${userId?.trim() || "anonymous"}`;
}

function readSnapshot(userId: string | null | undefined): readonly FavoritePropertyRef[] {
  if (typeof window === "undefined") return EMPTY_FAVORITES;

  const key = storageKey(userId);
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return EMPTY_FAVORITES;
  }
  const cached = snapshots.get(key);
  if (cached?.raw === raw) return cached.value;

  let value: readonly FavoritePropertyRef[] = EMPTY_FAVORITES;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        value = parsed.filter(
          (item): item is FavoritePropertyRef =>
            typeof item?.poNumber === "string" &&
            typeof item?.propertyId === "string" &&
            typeof item?.addedAtUtc === "string",
        );
      }
    } catch {
      value = EMPTY_FAVORITES;
    }
  }

  snapshots.set(key, { raw, value });
  return value;
}

function writeFavorites(
  userId: string | null | undefined,
  favorites: readonly FavoritePropertyRef[],
): void {
  if (typeof window === "undefined") return;
  const key = storageKey(userId);
  const raw = JSON.stringify(favorites);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    return;
  }
  snapshots.set(key, { raw, value: favorites });
  window.dispatchEvent(new Event(FAVORITE_PROPERTIES_CHANGED_EVENT));
}

function subscribe(
  userId: string | null | undefined,
  onChange: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const key = storageKey(userId);
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) onChange();
  };
  window.addEventListener(FAVORITE_PROPERTIES_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(FAVORITE_PROPERTIES_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Stable identity for one favorited property inside a work order. */
export function favoritePropertyKey(
  poNumber: string,
  propertyId: string,
): string {
  return `${poNumber.trim()}::${propertyId.trim()}`;
}

export function useFavoriteProperties(): {
  favorites: readonly FavoritePropertyRef[];
  favoriteKeys: ReadonlySet<string>;
  isFavorite: (poNumber: string, propertyId: string) => boolean;
  toggleFavorite: (poNumber: string, propertyId: string) => boolean;
} {
  const userId = useAuthSession()?.user.id;
  const favorites = useSyncExternalStore(
    useCallback((onChange) => subscribe(userId, onChange), [userId]),
    useCallback(() => readSnapshot(userId), [userId]),
    () => EMPTY_FAVORITES,
  );

  const favoriteKeys = useMemo(
    () =>
      new Set(
        favorites.map((item) =>
          favoritePropertyKey(item.poNumber, item.propertyId),
        ),
      ),
    [favorites],
  );

  const isFavorite = useCallback(
    (poNumber: string, propertyId: string) =>
      favoriteKeys.has(favoritePropertyKey(poNumber, propertyId)),
    [favoriteKeys],
  );

  const toggleFavorite = useCallback(
    (poNumber: string, propertyId: string) => {
      const normalizedPo = poNumber.trim();
      const current = readSnapshot(userId);
      const exists = current.some(
        (item) =>
          item.poNumber === normalizedPo && item.propertyId === propertyId,
      );
      const next = exists
        ? current.filter(
            (item) =>
              item.poNumber !== normalizedPo || item.propertyId !== propertyId,
          )
        : [
            {
              poNumber: normalizedPo,
              propertyId,
              addedAtUtc: new Date().toISOString(),
            },
            ...current,
          ];
      writeFavorites(userId, next);
      return !exists;
    },
    [userId],
  );

  return { favorites, favoriteKeys, isFavorite, toggleFavorite };
}
