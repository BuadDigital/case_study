"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Note,
} from "@platform/design-system";
import { PAGE_TITLES } from "@platform/app-shared/prototype/constants";
import type { CustomAssignedScreen } from "@platform/types";
import {
  invalidateCustomAssignedScreensQueries,
  useAssignableUsersForCustomScreensQuery,
  useCustomAssignedScreensManageQuery,
} from "../../query/custom-screens-queries";
import {
  removeCustomAssignedScreen,
  saveCustomAssignedScreen,
} from "../../lib/custom-screens-api";
import { CustomScreenFormModal } from "./CustomScreenFormModal";

export function CustomScreenManagementTab() {
  const queryClient = useQueryClient();
  const { data: manageResult, isPending } = useCustomAssignedScreensManageQuery();
  const { data: usersResult } = useAssignableUsersForCustomScreensQuery();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomAssignedScreen | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const screens = manageResult?.screens ?? [];
  const users = usersResult?.users ?? [];
  const loadError = manageResult?.error ?? usersResult?.error ?? null;

  async function refresh(): Promise<void> {
    invalidateCustomAssignedScreensQueries(queryClient);
  }

  async function handleSave(payload: {
    name: string;
    targetPageId: string | null;
    iconPath: string | null;
    isActive: boolean;
    assignedUserIds: string[];
  }): Promise<void> {
    setBusy(true);
    const result = await saveCustomAssignedScreen(
      {
        name: payload.name,
        targetPageId: payload.targetPageId,
        iconPath: payload.iconPath,
        isActive: payload.isActive,
        assignedUserIds: payload.assignedUserIds,
      },
      editing?.id,
    );
    setBusy(false);
    if (!result.ok) {
      setToast(result.error);
      return;
    }
    setModalOpen(false);
    setEditing(null);
    setToast(editing ? "تم تحديث الشاشة." : "تمت إضافة الشاشة للمستخدمين المحددين.");
    await refresh();
  }

  async function handleDelete(screen: CustomAssignedScreen): Promise<void> {
    if (!window.confirm(`حذف الشاشة «${screen.name}»؟`)) return;
    setBusy(true);
    const result = await removeCustomAssignedScreen(screen.id);
    setBusy(false);
    if (!result.ok) {
      setToast(result.error ?? "تعذر الحذف.");
      return;
    }
    setToast("تم حذف الشاشة.");
    await refresh();
  }

  return (
    <article className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-text">إدارة الشاشات المخصصة</h2>
          <p className="mt-1 text-[11px] text-text-3">
            سليمان فقط — أضف شاشات واختر المستخدمين الذين تظهر لهم في القائمة الجانبية
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={busy || Boolean(loadError)}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          ＋ إضافة شاشة
        </Button>
      </header>

      {toast ? (
        <Note tone="info" className="mx-4 mt-3">
          {toast}
        </Note>
      ) : null}
      {loadError ? (
        <Note tone="danger" className="mx-4 mt-3">
          {loadError}
        </Note>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isPending ? (
          <p className="text-xs text-text-3">جاري التحميل…</p>
        ) : screens.length === 0 ? (
          <p className="py-10 text-center text-xs text-text-3">
            لا توجد شاشات مخصصة بعد. اضغط «إضافة شاشة» لإسناد صفحة لمستخدمين محددين.
          </p>
        ) : (
          <div className="space-y-2">
            {screens.map((screen) => (
              <section
                key={screen.id}
                className="rounded border border-border bg-surface px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-text">
                        {screen.name}
                      </h3>
                      <Badge tone={screen.isActive ? "success" : "default"}>
                        {screen.isActive ? "نشطة" : "معطّلة"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-text-3">
                      {screen.targetPageId?.trim()
                        ? `تفتح: ${PAGE_TITLES[screen.targetPageId as keyof typeof PAGE_TITLES] ?? screen.targetPageId}`
                        : "فارغة — بدون محتوى بعد"}
                    </p>
                    <p className="mt-2 text-[11px] text-text-3">
                      المستخدمون:{" "}
                      {screen.assignedUsers?.length
                        ? screen.assignedUsers
                            .map((user) => user.displayName)
                            .join("، ")
                        : "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setEditing(screen);
                        setModalOpen(true);
                      }}
                    >
                      تعديل
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handleDelete(screen)}
                    >
                      حذف
                    </Button>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {modalOpen ? (
        <CustomScreenFormModal
          users={users}
          initial={editing}
          onClose={() => {
            if (busy) return;
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={(payload) => void handleSave(payload)}
        />
      ) : null}
    </article>
  );
}
