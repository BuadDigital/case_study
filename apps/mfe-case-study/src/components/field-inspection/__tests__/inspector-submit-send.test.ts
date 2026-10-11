import { beforeEach, describe, expect, it, vi } from "vitest";

const saveInspectorWorkspaceDraft = vi.fn();
const updateInspectorWorkspace = vi.fn();

vi.mock("../../../lib/app-data/inspector-workspace-commands", () => ({
  saveInspectorWorkspaceDraft: (...args: unknown[]) => saveInspectorWorkspaceDraft(...args),
  updateInspectorWorkspace: (...args: unknown[]) => updateInspectorWorkspace(...args),
}));

import { createInspectorWorkspaceDraft } from "../../../lib/app-data/inspector-workspace-data";
import { sendInspectorSubmission } from "../inspector-submit-send";

const draft = createInspectorWorkspaceDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" });

function setup(opts: { dialog: boolean; result: unknown; throws?: Error }) {
  const host = {
    onSubmitted: vi.fn(),
    onSubmitQueued: vi.fn(),
    onSubmitFailed: vi.fn(),
    onSavingChange: vi.fn(),
    ...(opts.dialog ? { onSubmitStarted: vi.fn() } : {}),
  };
  const showToast = vi.fn();
  const run = () =>
    sendInspectorSubmission({
      draft,
      taskId: "t1",
      keyAvailable: true,
      hasPhone: true,
      execute: opts.throws
        ? () => Promise.reject(opts.throws)
        : () => Promise.resolve({ status: "done", value: opts.result as never }),
      hostRef: { current: host },
      setDraft: vi.fn(),
      setFieldErrors: vi.fn(),
      setFormError: vi.fn(),
      setActiveStep: vi.fn(),
      showToast,
    });
  return { host, showToast, run };
}

describe("sendInspectorSubmission", () => {
  beforeEach(() => {
    saveInspectorWorkspaceDraft.mockResolvedValue(draft);
    updateInspectorWorkspace.mockResolvedValue(draft);
  });

  it("tells a host with a sending dialog it was sent, and leaves the saying to the dialog", async () => {
    const { host, showToast, run } = setup({ dialog: true, result: { ok: true, draft } });
    expect(await run()).toBe(true);
    expect(host.onSubmitted).toHaveBeenCalledOnce();
    expect(host.onSubmitFailed).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("a host without the dialog still gets the success toast", async () => {
    const { host, showToast, run } = setup({ dialog: false, result: { ok: true, draft } });
    expect(await run()).toBe(true);
    expect(host.onSubmitted).toHaveBeenCalledOnce();
    expect(showToast).toHaveBeenCalledWith("تم حفظ بيانات المعاينة وإرسالها.", "success");
  });

  it("a send saved for later is reported as queued, not as sent", async () => {
    const { host, run } = setup({ dialog: true, result: { ok: true, draft, queued: true } });
    await run();
    expect(host.onSubmitQueued).toHaveBeenCalledOnce();
    expect(host.onSubmitted).not.toHaveBeenCalled();
  });

  it("a server refusal closes the dialog and shows the reason", async () => {
    const { host, showToast, run } = setup({
      dialog: true,
      result: { ok: false, message: "صور ناقصة" },
    });
    expect(await run()).toBe(false);
    expect(showToast).toHaveBeenCalledWith("صور ناقصة", "error");
    expect(host.onSubmitFailed).toHaveBeenCalledOnce();
    expect(host.onSubmitted).not.toHaveBeenCalled();
  });

  it("a thrown error closes the dialog too and never leaves the saving flag on", async () => {
    const { host, showToast, run } = setup({
      dialog: true,
      result: null,
      throws: new Error("انقطع الاتصال"),
    });
    expect(await run()).toBe(false);
    expect(showToast).toHaveBeenCalledWith("انقطع الاتصال", "error");
    expect(host.onSubmitFailed).toHaveBeenCalledOnce();
    expect(host.onSavingChange).toHaveBeenLastCalledWith(false);
  });
});
