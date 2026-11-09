import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TransactionDetailDto } from "@platform/api-client";

const query = vi.hoisted(() => ({ data: null as TransactionDetailDto | null }));

vi.mock("@platform/app-shared/query/transaction-by-property-query", () => ({
  useTransactionByPropertyQuery: () => ({ data: query.data }),
}));

import { useLinkedPropertyDeeds } from "../transaction-query";

const deed = (propertyId: string, isRemoved = false) =>
  ({ propertyId, isRemoved }) as unknown as TransactionDetailDto["deeds"][number];

describe("the linked property's deeds", () => {
  it("keeps one list across renders, so the report tab does not loop (2026-11-04)", () => {
    query.data = { deeds: [deed("a"), deed("b"), deed("c", true)] } as TransactionDetailDto;
    const { result, rerender } = renderHook(() => useLinkedPropertyDeeds("a"));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
    expect(first.map((d) => d.propertyId)).toEqual(["a", "b"]);
  });

  it("gives an ordinary property the same empty list every render", () => {
    query.data = { deeds: [deed("a")] } as TransactionDetailDto;
    const { result, rerender } = renderHook(() => useLinkedPropertyDeeds("a"));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
    expect(first).toEqual([]);
  });
});
