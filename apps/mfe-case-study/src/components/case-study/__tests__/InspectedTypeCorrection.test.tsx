import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({
  correct: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("../../../lib/app-data/inspector-workspace-commands", () => ({
  correctInspectedTypeOfWorkspace: state.correct,
}));
// The usage field reads the settings list; here it is a plain box.
vi.mock("../../field-inspection/InspectorPropertyUsageField", () => ({
  InspectorPropertyUsageField: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value: string;
    onChange: (next: string) => void;
  }) => <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />,
}));
vi.mock("@platform/ui-kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/ui-kit")>()),
  useToast: () => ({ showToast: state.toast }),
}));

import { InspectedTypeCorrection } from "../InspectedTypeCorrection";

const REASON = "الصك أرض فضاء والمبنى أزيل";

function show(over: Partial<Parameters<typeof InspectedTypeCorrection>[0]> = {}) {
  const props = {
    inspectionTaskId: "task-1",
    currentType: "فيلا",
    currentUsage: "سكني",
    bourseType: "فيلا",
    canCorrect: true,
    onCorrected: vi.fn(),
    ...over,
  };
  render(<InspectedTypeCorrection {...props} />);
  return props;
}
const openDialog = () => fireEvent.click(screen.getByRole("button", { name: "تعديل النوع والاستخدام" }));
const pickType = (type: string) =>
  fireEvent.change(screen.getByLabelText("نوع العقار"), { target: { value: type } });
const save = () => fireEvent.click(screen.getByRole("button", { name: "حفظ التعديل" }));

describe("InspectedTypeCorrection — «تعديل النوع والاستخدام»", () => {
  beforeEach(() => {
    state.correct.mockReset();
    state.toast.mockReset();
  });

  it("shows the type and the usage, and the bourse type only when it differs", () => {
    show({ currentType: "أرض سكنية", bourseType: "فيلا" });

    expect(screen.getByText("أرض سكنية")).toBeTruthy();
    expect(screen.getByText("سكني")).toBeTruthy();
    expect(screen.getByText("النوع في البورصة: فيلا")).toBeTruthy();
  });

  it("only reads for a viewer who may not correct", () => {
    show({ canCorrect: false });

    expect(screen.queryByRole("button", { name: "تعديل النوع والاستخدام" })).toBeNull();
    expect(screen.queryByText(/النوع في البورصة/)).toBeNull();
  });

  it("asks for the reason only once the type differs, and sends nothing without it", () => {
    show();
    openDialog();

    expect(screen.queryByLabelText(/سبب تعديل النوع/)).toBeNull();
    pickType("أرض سكنية");
    expect(screen.getByText(/تُخفى ولا تُحذف/)).toBeTruthy();
    save();

    expect(screen.getByText("اذكر سبب تعديل نوع العقار (10 أحرف على الأقل)")).toBeTruthy();
    expect(state.correct).not.toHaveBeenCalled();
  });

  it("saves the new type with its reason, tells the host and closes", async () => {
    state.correct.mockResolvedValue({ ok: true, data: {} });
    const props = show();
    openDialog();

    pickType("أرض سكنية");
    fireEvent.change(screen.getByLabelText(/سبب تعديل النوع/), { target: { value: REASON } });
    save();

    await waitFor(() => expect(props.onCorrected).toHaveBeenCalledOnce());
    expect(state.correct).toHaveBeenCalledWith("task-1", { propertyType: "أرض سكنية", reason: REASON });
    expect(state.toast).toHaveBeenCalledWith("تم تعديل نوع العقار", "success");
    expect(screen.queryByRole("button", { name: "حفظ التعديل" })).toBeNull();
  });

  it("saves a new usage alone without a reason", async () => {
    state.correct.mockResolvedValue({ ok: true, data: {} });
    show();
    openDialog();

    fireEvent.change(screen.getByLabelText("استخدام العقار"), { target: { value: "سكني تجاري" } });
    save();

    await waitFor(() =>
      expect(state.correct).toHaveBeenCalledWith("task-1", { propertyUsage: "سكني تجاري" }),
    );
  });

  it("keeps the window open on a refusal and shows the server's message", async () => {
    state.correct.mockResolvedValue({
      ok: false,
      error: "اعتمد المراجع الدراسة — لا تعديل على بيانات المعاملة",
    });
    const props = show();
    openDialog();

    pickType("عمارة");
    fireEvent.change(screen.getByLabelText(/سبب تعديل النوع/), { target: { value: REASON } });
    save();

    await waitFor(() => expect(screen.getByText(/اعتمد المراجع الدراسة/)).toBeTruthy());
    expect(props.onCorrected).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "حفظ التعديل" })).toBeTruthy();
  });

  it("closes without a request when nothing was changed", () => {
    show();
    openDialog();
    save();

    expect(state.correct).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "حفظ التعديل" })).toBeNull();
  });
});
