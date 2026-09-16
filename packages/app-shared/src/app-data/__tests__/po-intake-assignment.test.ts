import { describe, expect, it } from "vitest";
import {
  INFATH_SEED_CLIENT_ID,
  NABR_SEED_CLIENT_ID,
} from "@platform/api-client";
import { isNabrTransaction } from "../po-intake-assignment";

describe("isNabrTransaction", () => {
  it("is true when Nabr is the sub-client (report user) — the normal case", () => {
    expect(
      isNabrTransaction({
        clientId: INFATH_SEED_CLIENT_ID,
        reportUserClientIds: [NABR_SEED_CLIENT_ID],
      }),
    ).toBe(true);
  });

  it("is true when Nabr is set directly as the primary client — the legacy case", () => {
    expect(
      isNabrTransaction({ clientId: NABR_SEED_CLIENT_ID, reportUserClientIds: [] }),
    ).toBe(true);
  });

  it("is false when neither the client nor the report users are Nabr", () => {
    expect(
      isNabrTransaction({
        clientId: INFATH_SEED_CLIENT_ID,
        reportUserClientIds: ["some-other-client-id"],
      }),
    ).toBe(false);
    expect(
      isNabrTransaction({ clientId: INFATH_SEED_CLIENT_ID, reportUserClientIds: undefined }),
    ).toBe(false);
  });
});
