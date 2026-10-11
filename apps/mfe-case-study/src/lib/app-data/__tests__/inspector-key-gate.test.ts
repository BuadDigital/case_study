import { describe, expect, it } from "vitest";
import {
  inspectorKeyGateProblem,
  inspectorKeyGateStatus,
  inspectorKeySubmitGate,
} from "../inspector-key-gate";

const query = { data: undefined, isError: false, isPaused: false, offline: false };

describe("inspector key gate — unknown is never «no key»", () => {
  it("reads the query as known / loading / error / offline / unavailable", () => {
    expect(inspectorKeyGateStatus(query)).toBe("loading");
    expect(inspectorKeyGateStatus({ ...query, isError: true })).toBe("error");
    expect(inspectorKeyGateStatus({ ...query, isPaused: true })).toBe("offline");
    expect(inspectorKeyGateStatus({ ...query, offline: true, isError: true })).toBe("offline");
    expect(inspectorKeyGateStatus({ ...query, data: null })).toBe("unavailable");
    expect(inspectorKeyGateStatus({ ...query, data: { keyAvailable: false } })).toBe("known");
  });

  it("keeps a value already loaded when a refetch fails or the device is offline", () => {
    const data = { keyAvailable: true };
    expect(inspectorKeyGateStatus({ ...query, data, isError: true })).toBe("known");
    expect(inspectorKeyGateStatus({ ...query, data, offline: true, isPaused: true })).toBe("known");
  });

  it("lets submit through with the known answer, «no key» included", () => {
    expect(inspectorKeySubmitGate({ status: "known", keyAvailable: false })).toEqual({
      ok: true,
      keyAvailable: false,
    });
    expect(inspectorKeySubmitGate({ status: "known", keyAvailable: true })).toEqual({
      ok: true,
      keyAvailable: true,
    });
  });

  it.each(["loading", "error", "offline", "unavailable"] as const)(
    "blocks submit with an Arabic reason while the status is %s",
    (status) => {
      const gate = inspectorKeySubmitGate({ status, keyAvailable: null });
      expect(gate.ok).toBe(false);
      expect(!gate.ok && gate.reason).toMatch(/المفتاح/);
    },
  );

  it("shows a problem (with retry) only when the load failed or cannot run", () => {
    expect(inspectorKeyGateProblem("known")).toBeNull();
    expect(inspectorKeyGateProblem("loading")).toBeNull();
    expect(inspectorKeyGateProblem("error")).toMatch(/تعذّر/);
    expect(inspectorKeyGateProblem("offline")).toMatch(/دون اتصال/);
    expect(inspectorKeyGateProblem("unavailable")).toMatch(/تسجيل الدخول/);
  });
});
