"use client";

import type { RoleId } from "@platform/types";
import { Button, Select, cn, useToast } from "@platform/design-system";
import {
  assignmentMode,
  fieldDictionaryRoleIds,
  fieldDictionaryRoleLabel,
  screensForRole,
  type FieldDictionaryAssignment,
} from "@platform/app-shared/prototype/field-dictionary";

type Props = {
  assignments: FieldDictionaryAssignment[];
  onChange: (assignments: FieldDictionaryAssignment[]) => void;
};

export function FieldDictionaryAssignmentsEditor({
  assignments,
  onChange,
}: Props) {
  const { showToast } = useToast();

  function updateAssignment(
    index: number,
    patch: Partial<FieldDictionaryAssignment>,
  ): void {
    onChange(
      assignments.map((assignment, i) => {
        if (i !== index) return assignment;
        const next = { ...assignment, ...patch };
        if (next.mode === "view") {
          next.required = false;
          next.final = false;
        }
        return next;
      }),
    );
  }

  function handleRoleChange(index: number, role: RoleId): void {
    const duplicate = assignments.some(
      (assignment, i) => i !== index && assignment.role === role,
    );
    if (duplicate) {
      showToast("هذا الدور مُسنَد مسبقاً لهذا الحقل.", "error");
      return;
    }
    const allowed = screensForRole(role).map((screen) => screen.id);
    onChange(
      assignments.map((assignment, i) =>
        i === index
          ? {
              ...assignment,
              role,
              screens: assignment.screens.filter((screenId) =>
                allowed.includes(screenId),
              ),
            }
          : assignment,
      ),
    );
  }

  function toggleScreen(index: number, screenId: string): void {
    onChange(
      assignments.map((assignment, i) => {
        if (i !== index) return assignment;
        const has = assignment.screens.includes(screenId);
        return {
          ...assignment,
          screens: has
            ? assignment.screens.filter((id) => id !== screenId)
            : [...assignment.screens, screenId],
        };
      }),
    );
  }

  function addRole(): void {
    const used = new Set(assignments.map((assignment) => assignment.role));
    const nextRole =
      fieldDictionaryRoleIds().find((roleId) => !used.has(roleId)) ??
      fieldDictionaryRoleIds()[0] ??
      "case-specialist";
    onChange([
      ...assignments,
      {
        role: nextRole,
        screens: [],
        mode: "input",
        required: false,
        final: false,
      },
    ]);
  }

  return (
    <div className="space-y-2">
      {assignments.map((assignment, index) => {
        const roleScreens = screensForRole(assignment.role);
        return (
          <div
            key={`${assignment.role}-${index}`}
            className="rounded-lg border border-border p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <Select
                value={assignment.role}
                onChange={(event) =>
                  handleRoleChange(index, event.target.value as RoleId)
                }
                className="flex-1"
              >
                {fieldDictionaryRoleIds().map((roleId) => (
                  <option key={roleId} value={roleId}>
                    {fieldDictionaryRoleLabel(roleId)}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                className="shrink-0 text-xs text-danger-text"
                onClick={() =>
                  onChange(assignments.filter((_, i) => i !== index))
                }
              >
                حذف الدور
              </button>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-text-3">
              <label className="flex items-center gap-1.5">
                الاستخدام:
                <Select
                  value={assignment.mode ?? "input"}
                  onChange={(event) =>
                    updateAssignment(index, {
                      mode: event.target.value as "input" | "view",
                    })
                  }
                >
                  <option value="input">إدخال</option>
                  <option value="view">عرض فقط</option>
                </Select>
              </label>
              {assignmentMode(assignment) === "input" ? (
                <>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!assignment.final}
                      onChange={(event) =>
                        updateAssignment(index, { final: event.target.checked })
                      }
                    />
                    الدور المعتمد (القيمة النهائية)
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={!!assignment.required}
                      onChange={(event) =>
                        updateAssignment(index, {
                          required: event.target.checked,
                        })
                      }
                    />
                    إلزامي
                  </label>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {roleScreens.length === 0 ? (
                <span className="text-[11px] text-text-3">
                  لا توجد شاشات لهذا الدور
                </span>
              ) : (
                roleScreens.map((screen) => {
                  const on = assignment.screens.includes(screen.id);
                  return (
                    <button
                      key={screen.id}
                      type="button"
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px]",
                        on
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-surface-2 text-text-2",
                        screen.status === "مخططة" &&
                          "border-dashed border-warning text-warning",
                      )}
                      onClick={() => toggleScreen(index, screen.id)}
                    >
                      {screen.name}
                      {screen.status === "مخططة" ? " • مخططة" : ""}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={addRole}>
        ＋ أضف دوراً
      </Button>
    </div>
  );
}

export function normalizeFieldAssignments(
  assignments: FieldDictionaryAssignment[],
): FieldDictionaryAssignment[] {
  return assignments
    .filter((assignment) => assignment.screens.length > 0)
    .map((assignment) => {
      const mode = assignmentMode(assignment);
      return {
        ...assignment,
        mode,
        required: mode === "input" ? !!assignment.required : undefined,
        final: mode === "input" ? !!assignment.final : undefined,
      };
    });
}
