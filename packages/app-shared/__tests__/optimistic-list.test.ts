import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  optimisticPatchListItem,
  restoreOptimisticPatch,
  restoreQueryData,
} from "../src/query/optimistic-list";

type Row = { id: string; status: string };

describe("optimisticPatchListItem", () => {
  it("patches a matching row and restores when that row is unchanged", () => {
    const client = new QueryClient();
    const key = ["demo"] as const;
    const initial: Row[] = [
      { id: "a", status: "open" },
      { id: "b", status: "open" },
    ];
    client.setQueryData(key, initial);

    const snapshot = optimisticPatchListItem<Row>(
      client,
      key,
      (row) => row.id === "a",
      (row) => ({ ...row, status: "done" }),
    );

    expect(client.getQueryData<Row[]>(key)?.[0]?.status).toBe("done");
    expect(restoreOptimisticPatch(client, key, snapshot)).toBe("restored");
    expect(client.getQueryData<Row[]>(key)?.[0]?.status).toBe("open");
    expect(client.getQueryData<Row[]>(key)?.[1]?.status).toBe("open");
  });

  it("preserves a concurrent patch on another row when rolling back", () => {
    const client = new QueryClient();
    const key = ["demo"] as const;
    client.setQueryData(key, [
      { id: "a", status: "review" },
      { id: "b", status: "review" },
    ] satisfies Row[]);

    const first = optimisticPatchListItem<Row>(
      client,
      key,
      (row) => row.id === "a",
      (row) => ({ ...row, status: "approved" }),
    );
    const second = optimisticPatchListItem<Row>(
      client,
      key,
      (row) => row.id === "b",
      (row) => ({ ...row, status: "suspended" }),
    );

    expect(restoreOptimisticPatch(client, key, first)).toBe("restored");
    expect(client.getQueryData<Row[]>(key)?.[0]?.status).toBe("review");
    expect(client.getQueryData<Row[]>(key)?.[1]?.status).toBe("suspended");

    expect(restoreOptimisticPatch(client, key, second)).toBe("restored");
    expect(client.getQueryData<Row[]>(key)?.[1]?.status).toBe("review");
  });

  it("invalidates when the same row was overwritten by a newer patch", () => {
    const client = new QueryClient();
    const key = ["demo"] as const;
    client.setQueryData(key, [{ id: "a", status: "review" }] satisfies Row[]);

    const first = optimisticPatchListItem<Row>(
      client,
      key,
      (row) => row.id === "a",
      (row) => ({ ...row, status: "approved" }),
    );
    optimisticPatchListItem<Row>(
      client,
      key,
      (row) => row.id === "a",
      (row) => ({ ...row, status: "suspended" }),
    );

    const invalidate = vi.spyOn(client, "invalidateQueries");
    expect(restoreOptimisticPatch(client, key, first)).toBe("invalidated");
    expect(invalidate).toHaveBeenCalled();
    expect(client.getQueryData<Row[]>(key)?.[0]?.status).toBe("suspended");
  });

  it("restoreQueryData still supports unconditional rollback", () => {
    const client = new QueryClient();
    const key = ["demo"] as const;
    client.setQueryData(key, [{ id: "a", status: "open" }] satisfies Row[]);
    restoreQueryData(client, key, [{ id: "a", status: "done" }]);
    expect(client.getQueryData<Row[]>(key)?.[0]?.status).toBe("done");
  });
});
