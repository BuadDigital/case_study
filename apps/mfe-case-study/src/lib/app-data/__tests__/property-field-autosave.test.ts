import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../po-intake-commands", () => ({
  updatePropertyInPo: vi.fn(async () => ({ ok: true, data: {} })),
}));

import { emptyProperty } from "../po-intake-data";
import { updatePropertyInPo } from "../po-intake-commands";
import {
  cancelPropertyFieldAutosave,
  flushPropertyFieldAutosave,
  isMeaningfulPropertyDraft,
  peekPropertyFieldAutosave,
  propertyFieldAutosaveKey,
  queuePropertyFieldAutosave,
} from "../property-field-autosave";

describe("propertyFieldAutosaveKey", () => {
  it("keys each صك by po + property id so drafts never collide", () => {
    expect(propertyFieldAutosaveKey(" PO-1 ", " aaa ")).toBe("PO-1|aaa");
    expect(propertyFieldAutosaveKey("PO-1", "prop-a")).not.toBe(
      propertyFieldAutosaveKey("PO-1", "prop-b"),
    );
    expect(propertyFieldAutosaveKey("PO-1", "prop-a")).not.toBe(
      propertyFieldAutosaveKey("PO-2", "prop-a"),
    );
  });
});

describe("property field autosave drafts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(updatePropertyInPo).mockReset();
    vi.mocked(updatePropertyInPo).mockResolvedValue({
      ok: true,
      data: emptyProperty(),
    });
  });

  afterEach(() => {
    cancelPropertyFieldAutosave("PO-1", "prop-a");
    cancelPropertyFieldAutosave("PO-1", "prop-b");
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("peek returns the latest queued draft so close/reopen keeps typed fields", () => {
    queuePropertyFieldAutosave("PO-1", "prop-a", {
      ...emptyProperty(),
      id: "prop-a",
      ownerName: "أحمد",
    });
    expect(peekPropertyFieldAutosave("PO-1", "prop-a")?.ownerName).toBe("أحمد");
    expect(peekPropertyFieldAutosave("PO-1", "prop-b")).toBeNull();
  });

  it("drops the draft after a successful persist so reopen uses server data", async () => {
    queuePropertyFieldAutosave("PO-1", "prop-a", {
      ...emptyProperty(),
      id: "prop-a",
      city: "جدة",
    });
    await vi.advanceTimersByTimeAsync(400);
    await flushPropertyFieldAutosave("PO-1", "prop-a");
    expect(updatePropertyInPo).toHaveBeenCalled();
    expect(peekPropertyFieldAutosave("PO-1", "prop-a")).toBeNull();
  });

  it("keeps the draft when persist fails", async () => {
    vi.mocked(updatePropertyInPo).mockResolvedValue({
      ok: false,
      error: "تعذّر الحفظ",
    });
    queuePropertyFieldAutosave("PO-1", "prop-a", {
      ...emptyProperty(),
      id: "prop-a",
      district: "الروضة",
    });
    await flushPropertyFieldAutosave("PO-1", "prop-a");
    expect(peekPropertyFieldAutosave("PO-1", "prop-a")?.district).toBe(
      "الروضة",
    );
  });

  it("yields a local draft when the fetched property is newer", () => {
    queuePropertyFieldAutosave("PO-1", "prop-a", {
      ...emptyProperty(),
      id: "prop-a",
      city: "جدة",
      updatedAtUtc: "2026-01-01T00:00:00.000Z",
    });
    expect(peekPropertyFieldAutosave("PO-1", "prop-a")?.city).toBe("جدة");
    expect(
      peekPropertyFieldAutosave("PO-1", "prop-a", "2026-01-01T00:00:00.000Z")
        ?.city,
    ).toBe("جدة");
    expect(
      peekPropertyFieldAutosave("PO-1", "prop-a", "2026-01-02T00:00:00.000Z"),
    ).toBeNull();
    expect(peekPropertyFieldAutosave("PO-1", "prop-a")).toBeNull();
  });

  it("keeps a newer keystroke when an older persist finishes", async () => {
    let releaseFirst!: (value: { ok: true; data: ReturnType<typeof emptyProperty> }) => void;
    vi.mocked(updatePropertyInPo).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = resolve;
        }),
    );
    queuePropertyFieldAutosave("PO-1", "prop-a", {
      ...emptyProperty(),
      id: "prop-a",
      city: "جدة",
    });
    await vi.advanceTimersByTimeAsync(400);
    queuePropertyFieldAutosave("PO-1", "prop-a", {
      ...emptyProperty(),
      id: "prop-a",
      city: "جدة",
      ownerName: "أحمد",
    });
    releaseFirst({
      ok: true,
      data: { ...emptyProperty(), updatedAtUtc: "2026-01-02T00:00:00.000Z" },
    });
    await Promise.resolve();
    expect(peekPropertyFieldAutosave("PO-1", "prop-a")?.ownerName).toBe("أحمد");
  });

  it("does not persist an empty draft that would wipe the data-entry screen", async () => {
    queuePropertyFieldAutosave("PO-1", "prop-a", {
      ...emptyProperty(),
      id: "prop-a",
    });
    expect(isMeaningfulPropertyDraft(emptyProperty())).toBe(false);
    expect(peekPropertyFieldAutosave("PO-1", "prop-a")).toBeNull();
    await flushPropertyFieldAutosave("PO-1", "prop-a");
    expect(updatePropertyInPo).not.toHaveBeenCalled();
  });

  it("keeps a not-yet-created property's draft locally without a doomed PUT", async () => {
    queuePropertyFieldAutosave(
      "PO-1",
      "new:task-1",
      { ...emptyProperty(), id: "new:task-1", ownerName: "سالم" },
      { persistable: false },
    );
    await vi.advanceTimersByTimeAsync(400);
    await flushPropertyFieldAutosave("PO-1", "new:task-1");
    expect(updatePropertyInPo).not.toHaveBeenCalled();
    expect(peekPropertyFieldAutosave("PO-1", "new:task-1")?.ownerName).toBe(
      "سالم",
    );
    cancelPropertyFieldAutosave("PO-1", "new:task-1");
  });
});
