import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listClients: vi.fn(),
  getValuationLists: vi.fn(),
}));

vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  ...api,
}));
vi.mock("@platform/auth-client", () => ({ getAuthSession: () => ({ token: "t" }) }));
vi.mock("../../../lib/case-study-bridge", () => ({ fetchInspectorWorkspace: async () => null }));

import { loadReportOutputBundle } from "../evaluator-report-output-helpers";

beforeEach(() => {
  api.listClients.mockReset();
  api.getValuationLists.mockReset();
  api.getValuationLists.mockResolvedValue({ ok: true, data: { lists: {} } });
});

describe("report tab data (round 2)", () => {
  it("never asks for GET /api/clients — a case-staff endpoint that answered the appraiser 403", async () => {
    const bundle = await loadReportOutputBundle({
      property: null,
      poNumber: "",
      inspectionTaskId: null,
      surveyTaskId: null,
    });
    expect(api.listClients).not.toHaveBeenCalled();
    expect(api.getValuationLists).toHaveBeenCalledOnce();
    expect(bundle.lists).toEqual({});
  });
});
