"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useAuthSession } from "@platform/app-shared/auth/use-auth-session";
import { FAVORITE_PROPERTIES_CHANGED_EVENT } from "@platform/app-shared/events/app-events";
import { createUserListStore } from "./user-list-store";

type FavoritePropertyRef = {
  poNumber: string;
  propertyId: string;
  addedAtUtc: string;
};

/** «المفضلة», kept per user on this device (`createUserListStore`). */
const favoritesStore = createUserListStore<FavoritePropertyRef>({
  prefix: "ejada.favorite-properties.v1",
  changedEvent: FAVORITE_PROPERTIES_CHANGED_EVENT,
  isItem: (item): item is FavoritePropertyRef => {
    const ref = item as Partial<FavoritePropertyRef> | null;
    return (
      typeof ref?.poNumber === "string" &&
      typeof ref?.propertyId === "string" &&
      typeof ref?.addedAtUtc === "string"
    );
  },
});

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
    useCallback((onChange) => favoritesStore.subscribe(userId, onChange), [userId]),
    useCallback(() => favoritesStore.read(userId), [userId]),
    () => favoritesStore.empty,
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
      const current = favoritesStore.read(userId);
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
      favoritesStore.write(userId, next);
      return !exists;
    },
    [userId],
  );

  return { favorites, favoriteKeys, isFavorite, toggleFavorite };
}
