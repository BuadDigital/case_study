import { describe, expect, it } from "vitest";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  activationTicketErrorMessage,
  applyRoleChange,
  buildCreateStaffUserPayload,
  canDeleteUser,
  createUserErrorMessage,
  deleteUserErrorMessage,
  deptLabel,
  disableUserConfirmCopy,
  EMPTY_STAFF_FORM,
  emptyUsersMessage,
  filterStaffUsers,
  formatLastLogin,
  INSPECTOR_TYPE_OPTIONS,
  reactivateErrorMessage,
  ROLE_SELECT_OPTIONS,
  saveEditErrors,
  statusLabel,
  statusTone,
  SUPERVISOR_DEPARTMENT_SELECT_OPTIONS,
  unlockErrorMessage,
  userToggleLabel,
  validateStaffForm,
  withoutFieldError,
  withoutRoleErrors,
  type StaffFormState,
} from "../users/users-organization-state";

function validForm(patch: Partial<StaffFormState> = {}): StaffFormState {
  return {
    ...EMPTY_STAFF_FORM,
    displayName: "سعد",
    roleId: "case-specialist",
    email: "saad@example.com",
    mobile: "0512345678",
    city: "الرياض",
    nationalId: "1234567890",
    ...patch,
  };
}

function user(patch: Partial<StaffUser> = {}): StaffUser {
  return {
    id: "u1",
    name: "سعد",
    role: "أخصائي",
    email: "saad@example.com",
    type: "internal",
    status: "Active",
    ...patch,
  } as StaffUser;
}

describe("option lists", () => {
  it("expose value/label pairs", () => {
    expect(ROLE_SELECT_OPTIONS.length).toBeGreaterThan(0);
    expect(ROLE_SELECT_OPTIONS.every((o) => o.value && o.label)).toBe(true);
    expect(SUPERVISOR_DEPARTMENT_SELECT_OPTIONS.map((o) => o.value)).toEqual(["case_study", "valuation"]);
    expect(INSPECTOR_TYPE_OPTIONS.map((o) => o.value)).toEqual(["employee", "contractor"]);
  });
});

describe("validateStaffForm", () => {
  it("accepts a complete form", () => {
    expect(validateStaffForm(validForm())).toEqual({});
  });

  it("requires the six base fields", () => {
    const errors = validateStaffForm(EMPTY_STAFF_FORM);
    expect(Object.keys(errors).sort()).toEqual(
      ["city", "displayName", "email", "mobile", "nationalId", "roleId"].sort(),
    );
  });

  it("checks formats", () => {
    expect(validateStaffForm(validForm({ email: "bad" })).email).toBe("صيغة البريد الإلكتروني غير صحيحة.");
    expect(validateStaffForm(validForm({ mobile: "123" })).mobile).toBe("صيغة رقم الجوال غير صحيحة.");
    expect(validateStaffForm(validForm({ mobile: "+966512345678" })).mobile).toBeUndefined();
    expect(validateStaffForm(validForm({ nationalId: "3234567890" })).nationalId).toBe(
      "رقم الهوية يجب أن يتكون من 10 أرقام.",
    );
    expect(validateStaffForm(validForm({ iban: "SA12" })).iban).toBe("صيغة الآيبان السعودي غير صحيحة.");
    expect(validateStaffForm(validForm({ iban: "SA 1234567890123456789012" })).iban).toBeUndefined();
    expect(validateStaffForm(validForm({ avatarUrl: "ftp://x" })).avatarUrl).toBe("رابط الصورة الشخصية غير صالح.");
  });

  it("applies role-conditional rules", () => {
    expect(validateStaffForm(validForm({ roleId: "field-inspector" })).inspectorType).toBe("نوع المعاين مطلوب.");
    expect(validateStaffForm(validForm({ roleId: "field-inspector", inspectorType: "employee" })).inspectorType).toBeUndefined();
    expect(validateStaffForm(validForm({ roleId: "section-supervisor" })).department).toBe(
      "يجب اختيار قسم المشرف: دراسة الحالة أو التقييم.",
    );
    expect(validateStaffForm(validForm({ roleId: "section-supervisor", department: "valuation" })).department).toBeUndefined();
    expect(validateStaffForm(validForm({ hasCompensation: true })).feeValueSar).toBe("قيمة الأتعاب مطلوبة.");
    expect(validateStaffForm(validForm({ hasCompensation: true, feeValueSar: "-1" })).feeValueSar).toBe("قيمة الأتعاب مطلوبة.");
    expect(validateStaffForm(validForm({ hasCompensation: true, feeValueSar: "100" })).feeValueSar).toBeUndefined();
  });
});

describe("form transitions", () => {
  it("applyRoleChange keeps the department only for supervisors", () => {
    const prev = validForm({ department: "valuation" });
    expect(applyRoleChange(prev, "section-supervisor").department).toBe("valuation");
    expect(applyRoleChange(prev, "cdo").department).toBe("");
    expect(applyRoleChange(prev, "cdo").roleId).toBe("cdo");
  });

  it("error trimming helpers", () => {
    expect(withoutRoleErrors({ roleId: "a", department: "b", email: "c" })).toEqual({ email: "c" });
    const errors = { email: "x" };
    expect(withoutFieldError(errors, "mobile")).toBe(errors);
    expect(withoutFieldError(errors, "email")).toEqual({});
  });
});

describe("buildCreateStaffUserPayload", () => {
  it("trims and drops optional blanks", () => {
    const payload = buildCreateStaffUserPayload(
      validForm({ displayName: " سعد ", iban: " ", taxNumber: "", joinedAt: "", avatarUrl: "" }),
    );
    expect(payload.displayName).toBe("سعد");
    expect(payload.department).toBeUndefined();
    expect(payload.inspectorType).toBeUndefined();
    expect(payload.feeValueSar).toBeUndefined();
    expect(payload.iban).toBeUndefined();
    expect(payload.taxNumber).toBeUndefined();
    expect(payload.joinedAt).toBeUndefined();
    expect(payload.avatarUrl).toBeUndefined();
    expect(payload.hasCompensation).toBe(false);
  });

  it("sends supervisor department and compensation when present", () => {
    const payload = buildCreateStaffUserPayload(
      validForm({
        roleId: "section-supervisor",
        department: " case_study ",
        hasCompensation: true,
        feeValueSar: "250",
        joinedAt: "2026-01-01",
      }),
    );
    expect(payload.department).toBe("case_study");
    expect(payload.feeValueSar).toBe(250);
    expect(payload.joinedAt).toBe("2026-01-01");
  });
});

describe("row presentation", () => {
  it("status tone / label / toggle label", () => {
    expect(statusTone("Active")).toBe("success");
    expect(statusTone("Locked")).toBe("danger");
    expect(statusTone("PendingActivation")).toBe("warning");
    expect(statusTone("Disabled")).toBe("default");
    expect(statusLabel("Active")).toBe("نشط");
    expect(statusLabel("Disabled")).toBe("معطّل");
    expect(statusLabel("PendingActivation")).toBe("بانتظار التفعيل");
    expect(statusLabel("Locked")).toBe("موقوف");
    expect(statusLabel(undefined)).toBe("—");
    expect(statusLabel("Weird")).toBe("Weird");
    expect(userToggleLabel("Locked")).toBe("فك القفل");
    expect(userToggleLabel("PendingActivation")).toBe("دعوة");
    expect(userToggleLabel("Disabled")).toBe("تفعيل");
    expect(userToggleLabel("Active")).toBe("تعطيل");
  });

  it("canDeleteUser protects self and seeded admin accounts", () => {
    expect(canDeleteUser(user(), "u1")).toBe(false);
    expect(canDeleteUser(user(), "other")).toBe(true);
    expect(canDeleteUser(user({ email: " S.Salhy@gmail.com " }), null)).toBe(false);
    expect(canDeleteUser(user({ userName: "Admin" }), null)).toBe(false);
  });

  it("formatLastLogin / deptLabel", () => {
    expect(formatLastLogin(null)).toBe("—");
    expect(formatLastLogin("2026-09-05T10:00:00Z")).not.toBe("—");
    expect(deptLabel(user({ department: "case_study" }))).toBe("قسم دراسة الحالة");
    // Unknown codes pass through untrimmed — supervisingDepartmentLabel returns the code itself.
    expect(deptLabel(user({ department: " custom " }))).toBe(" custom ");
    expect(deptLabel(user({ department: "" }))).toBe("—");
    expect(deptLabel(user({ department: null }))).toBe("—");
  });

  it("filterStaffUsers by status and name", () => {
    const users = [
      user({ id: "a", name: "سعد", status: "Active" }),
      user({ id: "b", name: "ماجد", status: "Disabled" }),
      user({ id: "c", name: "سعيد", status: "Locked" }),
      user({ id: "d", name: "سامي", status: "PendingActivation" }),
    ];
    expect(filterStaffUsers(users, "", "all").map((u) => u.id)).toEqual(["a", "b", "c", "d"]);
    expect(filterStaffUsers(users, "", "on").map((u) => u.id)).toEqual(["a"]);
    expect(filterStaffUsers(users, "", "off").map((u) => u.id)).toEqual(["b", "c"]);
    expect(filterStaffUsers(users, " سع ", "all").map((u) => u.id)).toEqual(["a", "c"]);
    expect(emptyUsersMessage(0)).toBe("لا يوجد مستخدمون بعد");
    expect(emptyUsersMessage(3)).toBe("لا يوجد مستخدمون مطابقون للبحث");
  });
});

describe("dialog copy and API error mapping", () => {
  it("disable confirm names the user", () => {
    expect(disableUserConfirmCopy("سعد")).toEqual({
      title: "تعطيل مستخدم",
      body: "«سعد» يفقد الدخول فوراً وتبقى سجلاته في سجل التدقيق.",
      confirm: "تعطيل",
    });
  });

  it("maps each failure kind to the screen's message", () => {
    expect(createUserErrorMessage({ kind: "network" })).toBe("تعذر الاتصال بالخادم.");
    expect(createUserErrorMessage({ kind: "server" })).toBe("تعذر إنشاء المستخدم.");
    expect(activationTicketErrorMessage({ kind: "server", message: "m" })).toBe("m");
    expect(activationTicketErrorMessage({ kind: "server" })).toBe("تعذر إصدار دعوة التفعيل.");
    expect(deleteUserErrorMessage({ kind: "validation", message: "v" })).toBe("v");
    expect(deleteUserErrorMessage({ kind: "validation" })).toBe("تعذر تعطيل المستخدم.");
    expect(deleteUserErrorMessage({ kind: "network" })).toBe("تعذر الاتصال بالخادم.");
    expect(saveEditErrors({ kind: "validation", errors: { email: "e" } })).toEqual({ email: "e" });
    expect(saveEditErrors({ kind: "network" })).toEqual({ _form: "تعذر الاتصال بالخادم." });
    expect(saveEditErrors({ kind: "server" })).toEqual({ _form: "تعذر حفظ التعديلات." });
    expect(reactivateErrorMessage({ kind: "validation", errors: { status: "s" } })).toBe("s");
    expect(reactivateErrorMessage({ kind: "validation", errors: { _form: "f", status: "s" } })).toBe("f");
    expect(reactivateErrorMessage({ kind: "validation" })).toBe("تعذر تفعيل المستخدم.");
    expect(reactivateErrorMessage({ kind: "network" })).toBe("تعذر الاتصال بالخادم.");
    expect(unlockErrorMessage({ kind: "network" })).toBe("تعذر الاتصال بالخادم.");
    expect(unlockErrorMessage({ kind: "validation", message: "u" })).toBe("u");
    expect(unlockErrorMessage({ kind: "server" })).toBe("تعذر فك قفل الحساب.");
  });
});
