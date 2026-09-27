import { describe, expect, it } from "vitest";
import {
  IDEMPOTENCY_HEADER,
  mergeHeaderRecords,
  withIdempotencyKey,
} from "./idempotency-key";

describe("withIdempotencyKey", () => {
  it("returns a plain record so spreading keeps Authorization", () => {
    const headers = withIdempotencyKey(
      {
        Authorization: "Bearer tok",
        "Content-Type": "application/json",
      },
      "idem-1",
    );

    expect(headers).not.toBeInstanceOf(Headers);
    expect({ ...headers }).toEqual({
      Authorization: "Bearer tok",
      "Content-Type": "application/json",
      [IDEMPOTENCY_HEADER]: "idem-1",
    });
  });

  it("merges a Headers object with extra init headers", () => {
    const merged = mergeHeaderRecords(
      withIdempotencyKey(
        {
          Authorization: "Bearer tok",
          "Content-Type": "application/json",
        },
        "idem-1",
      ),
      { Accept: "application/json" },
    );
    expect(merged.Authorization).toBe("Bearer tok");
    expect(merged[IDEMPOTENCY_HEADER]).toBe("idem-1");
    expect(merged.Accept).toBe("application/json");
  });
});
