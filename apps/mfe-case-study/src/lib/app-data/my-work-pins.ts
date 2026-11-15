"use client";

/**
 * Pinned rows of «أعمالي» (Omar 2026-11-12, for every role): in each stage the viewer may pin up to
 * five transactions; a pinned row rises to the top of the list, and the pin ends by itself once the
 * transaction is sent on to the next step.
 *
 * How it works: a pin is the row's key — `{stage}:{task}` — so it belongs to one stage. When the
 * transaction moves on, its row in that stage is gone (the next stage's row has another key), and
 * `prunePins` drops the pin the next time the list is loaded. The pins are the viewer's own, kept on
 * this device like «المفضلة» (`createUserListStore`).
 * A pinned transaction is also listed on the «المفضلة» page while its pin lasts (Omar 2026-11-12:
 * «اللي اخترتها مفضلة وديها للمفضلة») — `useMyWorkPinnedProperties`; the star in a property's header
 * stays the lasting favourite, removed by hand only.
 * The rules are pure functions; `useMyWorkPins` wires them to the store.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useAuthSession } from "@platform/app-shared/auth/use-auth-session";
import { favoritePropertyKey, useFavoriteProperties } from "./favorite-properties";
import type { MyWorkItem, MyWorkStage } from "./my-work-model";
import { createUserListStore } from "./user-list-store";

/** How many rows one stage may hold pinned. */
export const MY_WORK_PIN_LIMIT = 5;

export type MyWorkPin = {
  /** The pinned row's key (`MyWorkItem.key`). */
  key: string;
  stage: MyWorkStage;
  pinnedAtUtc: string;
  /** The pinned transaction — what «المفضلة» lists it by; absent for a row with no deed yet. */
  poNumber?: string;
  propertyId?: string;
};

type PinnableRow = Pick<MyWorkItem, "key" | "stage"> & Partial<Pick<MyWorkItem, "poNumber" | "propertyId">>;

const pinsStore = createUserListStore<MyWorkPin>({
  prefix: "ejada.my-work-pins.v1",
  changedEvent: "my-work-pins-changed",
  isItem: (item): item is MyWorkPin => {
    const pin = item as Partial<MyWorkPin> | null;
    return (
      typeof pin?.key === "string" &&
      typeof pin?.stage === "string" &&
      typeof pin?.pinnedAtUtc === "string"
    );
  },
});

/**
 * Pins or unpins a row.
 *
 * How it works: a pinned row is unpinned; an unpinned one is pinned unless its stage already holds
 * `MY_WORK_PIN_LIMIT` pins — then nothing changes and the result says «full».
 * Edge cases: the limit is per stage, so a full stage does not stop a pin in another one.
 */
export function togglePin(
  pins: readonly MyWorkPin[],
  row: PinnableRow,
  nowIso: string,
): { pins: readonly MyWorkPin[]; result: "pinned" | "unpinned" | "full" } {
  if (pins.some((pin) => pin.key === row.key)) {
    return { pins: pins.filter((pin) => pin.key !== row.key), result: "unpinned" };
  }
  if (pins.filter((pin) => pin.stage === row.stage).length >= MY_WORK_PIN_LIMIT) {
    return { pins, result: "full" };
  }
  return {
    pins: [
      ...pins,
      {
        key: row.key,
        stage: row.stage,
        pinnedAtUtc: nowIso,
        ...(row.poNumber && row.propertyId
          ? { poNumber: row.poNumber.trim(), propertyId: row.propertyId }
          : {}),
      },
    ],
    result: "pinned",
  };
}

/** The pins without those of one transaction — «إزالة من المفضلة» on the «المفضلة» page. */
export function unpinProperty(
  pins: readonly MyWorkPin[],
  poNumber: string,
  propertyId: string,
): readonly MyWorkPin[] {
  const key = favoritePropertyKey(poNumber, propertyId);
  const kept = pins.filter(
    (pin) => !pin.poNumber || !pin.propertyId || favoritePropertyKey(pin.poNumber, pin.propertyId) !== key,
  );
  return kept.length === pins.length ? pins : kept;
}

/**
 * The pins that still have a row — the rest ended: their transaction went on to the next step
 * (or left the viewer's list).
 *
 * How it works: keeps a pin whose key is among the rows; returns the SAME array when nothing was
 * dropped, so the caller can tell whether there is anything to save.
 * Edge cases: call it only with the fully loaded list — an empty list while loading would end
 * every pin.
 */
export function prunePins(
  pins: readonly MyWorkPin[],
  rows: readonly Pick<MyWorkItem, "key">[],
): readonly MyWorkPin[] {
  const live = new Set(rows.map((row) => row.key));
  const kept = pins.filter((pin) => live.has(pin.key));
  return kept.length === pins.length ? pins : kept;
}

/**
 * The rows with the pinned ones first.
 *
 * How it works: a stable split — the pinned rows keep the order they had among themselves (late
 * first, as the list sorts them), then the rest in theirs.
 */
export function pinnedFirst<T extends Pick<MyWorkItem, "key">>(
  rows: readonly T[],
  pinnedKeys: ReadonlySet<string>,
): T[] {
  if (pinnedKeys.size === 0) return [...rows];
  return [...rows.filter((row) => pinnedKeys.has(row.key)), ...rows.filter((row) => !pinnedKeys.has(row.key))];
}

/** The signed-in viewer and his stored pins, re-read when they change (here or in another tab). */
function useStoredPins(): { userId: string | undefined; pins: readonly MyWorkPin[] } {
  const userId = useAuthSession()?.user.id;
  const pins = useSyncExternalStore(
    useCallback((onChange) => pinsStore.subscribe(userId, onChange), [userId]),
    useCallback(() => pinsStore.read(userId), [userId]),
    () => pinsStore.empty,
  );
  return { userId, pins };
}

/**
 * The viewer's pins and the two things the page does with them.
 *
 * `toggle` pins or unpins a row and returns what happened (the page toasts «full»);
 * `endFinished` is called with the loaded list and ends the pins whose rows are gone.
 */
export function useMyWorkPins(): {
  pinnedKeys: ReadonlySet<string>;
  toggle: (row: PinnableRow) => "pinned" | "unpinned" | "full";
  endFinished: (rows: readonly Pick<MyWorkItem, "key">[]) => void;
} {
  const { userId, pins } = useStoredPins();
  const pinnedKeys = useMemo(() => new Set(pins.map((pin) => pin.key)), [pins]);

  const toggle = useCallback(
    (row: PinnableRow) => {
      const next = togglePin(pinsStore.read(userId), row, new Date().toISOString());
      if (next.result !== "full") pinsStore.write(userId, next.pins);
      return next.result;
    },
    [userId],
  );

  const endFinished = useCallback(
    (rows: readonly Pick<MyWorkItem, "key">[]) => {
      const current = pinsStore.read(userId);
      const kept = prunePins(current, rows);
      if (kept !== current) pinsStore.write(userId, kept);
    },
    [userId],
  );

  return { pinnedKeys, toggle, endFinished };
}

/**
 * The transactions pinned in «أعمالي», for the «المفضلة» page: their keys (as `favoritePropertyKey`)
 * and the removal of one transaction's pins.
 */
export function useMyWorkPinnedProperties(): {
  pinnedPropertyKeys: ReadonlySet<string>;
  unpin: (poNumber: string, propertyId: string) => void;
} {
  const { userId, pins } = useStoredPins();
  const pinnedPropertyKeys = useMemo(
    () =>
      new Set(
        pins.flatMap((pin) =>
          pin.poNumber && pin.propertyId ? [favoritePropertyKey(pin.poNumber, pin.propertyId)] : [],
        ),
      ),
    [pins],
  );
  const unpin = useCallback(
    (poNumber: string, propertyId: string) => {
      const current = pinsStore.read(userId);
      const kept = unpinProperty(current, poNumber, propertyId);
      if (kept !== current) pinsStore.write(userId, kept);
    },
    [userId],
  );
  return { pinnedPropertyKeys, unpin };
}

/**
 * How many transactions «المفضلة» holds — the sidebar's counter (Omar 2026-11-12): the header's
 * favourites and the pins of «أعمالي», a transaction starred both ways counted once.
 */
export function useFavoriteTransactionsCount(): number {
  const { favoriteKeys } = useFavoriteProperties();
  const { pinnedPropertyKeys } = useMyWorkPinnedProperties();
  return useMemo(
    () => new Set([...favoriteKeys, ...pinnedPropertyKeys]).size,
    [favoriteKeys, pinnedPropertyKeys],
  );
}
