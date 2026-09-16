import { describe, expect, it } from "vitest";
import {
  INFATH_SEED_CLIENT_ID,
  NABR_SEED_CLIENT_ID,
} from "@platform/api-client";
import { clientFieldPolicyFor } from "../po-intake-assignment";

describe("clientFieldPolicyFor", () => {
  it("requires everything by default (Infath, no report users)", () => {
    expect(
      clientFieldPolicyFor({
        clientId: INFATH_SEED_CLIENT_ID,
        reportUserClientIds: [],
      }),
    ).toEqual({ requiresAssignmentDoc: true, requiresOwnerName: true });
  });

  it("relaxes قرار الإسناد و اسم المالك when Nabr is the sub-client (report user) — the normal case", () => {
    expect(
      clientFieldPolicyFor({
        clientId: INFATH_SEED_CLIENT_ID,
        reportUserClientIds: [NABR_SEED_CLIENT_ID],
      }),
    ).toEqual({ requiresAssignmentDoc: false, requiresOwnerName: false });
  });

  it("relaxes the same fields when Nabr is set directly as the primary client — the legacy case", () => {
    expect(
      clientFieldPolicyFor({ clientId: NABR_SEED_CLIENT_ID, reportUserClientIds: [] }),
    ).toEqual({ requiresAssignmentDoc: false, requiresOwnerName: false });
  });

  it("stays at the default when neither the client nor the report users are Nabr", () => {
    expect(
      clientFieldPolicyFor({
        clientId: INFATH_SEED_CLIENT_ID,
        reportUserClientIds: ["some-other-client-id"],
      }),
    ).toEqual({ requiresAssignmentDoc: true, requiresOwnerName: true });
    expect(
      clientFieldPolicyFor({ clientId: INFATH_SEED_CLIENT_ID, reportUserClientIds: undefined }),
    ).toEqual({ requiresAssignmentDoc: true, requiresOwnerName: true });
  });
});
