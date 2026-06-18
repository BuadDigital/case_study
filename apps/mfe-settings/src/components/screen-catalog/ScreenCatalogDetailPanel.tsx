"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, cn, useToast } from "@platform/design-system";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import {
  SCREEN_CATALOG_KIND_LABELS,
  SCREEN_CATALOG_STATUS_LABELS,
  humanizeScreenPath,
  screenCatalogRoleGroup,
  screenCatalogRoleLabel,
  type SystemScreenEntry,
} from "@platform/app-shared/prototype/screen-catalog";
import type { PageId } from "@platform/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  invalidateCustomAssignedScreensQueries,
  useAssignableUsersForCustomScreensQuery,
  useCustomAssignedScreensManageQuery,
} from "../../query/custom-screens-queries";
import { saveCustomAssignedScreen, removeCustomAssignedScreen } from "../../lib/custom-screens-api";
import {
  assignedUserIdsForPage,
  assignedUsersForPage,
  customScreenIdFromCatalogEntry,
  customScreensForPage,
  linkedScreenDisplayName,
  primaryCustomScreenForPage,
} from "../../lib/screen-catalog-access";
import { ScreenCatalogUserAccessModal } from "./ScreenCatalogUserAccessModal";

const DEFAULT_ICON =
  "M4 5h16v4H4zM4 13h10v6H4zM16 13h4v6h-4z";

export function ScreenCatalogDetailPanel({
  screen,
}: {
  screen: SystemScreenEntry;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role } = usePrototype();
  const customScreenId = customScreenIdFromCatalogEntry(screen.id);
  const isCustomScreen = Boolean(customScreenId);
  const pageId = screen.pageId as PageId | undefined;
  const canManageAccess =
    isSuperAdmin(role) && (Boolean(pageId) || isCustomScreen);

  const { data: manageResult } = useCustomAssignedScreensManageQuery();
  const { data: usersResult } = useAssignableUsersForCustomScreensQuery();
  const { showToast } = useToast();
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const customScreens = manageResult?.screens ?? [];
  const assignableUsers = usersResult?.users ?? [];
  const customScreen = useMemo(
    () =>
      customScreenId
        ? (customScreens.find((item) => item.id === customScreenId) ?? null)
        : null,
    [customScreenId, customScreens],
  );
  const extraUsers = useMemo(() => {
    if (customScreen) return customScreen.assignedUsers ?? [];
    return pageId ? assignedUsersForPage(customScreens, pageId) : [];
  }, [customScreen, customScreens, pageId]);
  const extraUserIds = useMemo(() => {
    if (customScreen) {
      return (customScreen.assignedUsers ?? []).map((user) => user.id);
    }
    return pageId ? assignedUserIdsForPage(customScreens, pageId) : [];
  }, [customScreen, customScreens, pageId]);

  const rolesByGroup = screen.roles.reduce<
    Record<string, typeof screen.roles>
  >((acc, roleId) => {
    const group = screenCatalogRoleGroup(roleId);
    if (!acc[group]) acc[group] = [];
    acc[group].push(roleId);
    return acc;
  }, {});

  async function handleSaveAccess(
    assignedUserIds: string[],
    successMessage?: string,
  ): Promise<void> {
    setBusy(true);

    if (customScreen) {
      const result = await saveCustomAssignedScreen(
        {
          name: customScreen.name,
          targetPageId: null,
          iconPath: customScreen.iconPath ?? DEFAULT_ICON,
          isActive: customScreen.isActive,
          assignedUserIds,
        },
        customScreen.id,
      );
      setBusy(false);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      setAccessModalOpen(false);
      showToast(successMessage ?? "تم تحديث المستخدمين المسندين.", "success");
      invalidateCustomAssignedScreensQueries(queryClient);
      return;
    }

    if (!pageId) {
      setBusy(false);
      return;
    }

    const linked = customScreensForPage(customScreens, pageId);
    const primary = primaryCustomScreenForPage(customScreens, pageId);

    if (assignedUserIds.length === 0) {
      for (const screen of linked) {
        const result = await removeCustomAssignedScreen(screen.id);
        if (!result.ok) {
          setBusy(false);
          showToast(result.error ?? "تعذر إلغاء الإسناد.", "error");
          return;
        }
      }
      setBusy(false);
      setAccessModalOpen(false);
      showToast(successMessage ?? "تم إلغاء إسناد المستخدمين الإضافيين.", "success");
      invalidateCustomAssignedScreensQueries(queryClient);
      return;
    }

    const payload = {
      name: linkedScreenDisplayName(pageId),
      targetPageId: pageId,
      iconPath: DEFAULT_ICON,
      isActive: true,
      assignedUserIds,
    };

    const firstResult = await saveCustomAssignedScreen(
      payload,
      primary?.id,
    );
    if (!firstResult.ok) {
      setBusy(false);
      showToast(firstResult.error, "error");
      return;
    }

    for (const extra of linked.slice(1)) {
      await saveCustomAssignedScreen(payload, extra.id);
    }

    setBusy(false);
    setAccessModalOpen(false);
    showToast(
      successMessage ??
        (assignedUserIds.length
          ? "تم تحديث المستخدمين الإضافيين."
          : "تم إلغاء إسناد المستخدمين الإضافيين."),
      "success",
    );
    invalidateCustomAssignedScreensQueries(queryClient);
  }

  async function handleRemoveUser(userId: string, displayName: string): Promise<void> {
    const next = extraUserIds.filter((id) => id !== userId);
    await handleSaveAccess(
      next,
      next.length
        ? `تم إزالة «${displayName}» من الإسناد.`
        : "تم إلغاء إسناد جميع المستخدمين.",
    );
  }

  async function handleDeleteCustomScreen(): Promise<void> {
    if (!customScreen) return;
    if (!window.confirm(`حذف الشاشة «${customScreen.name}»؟`)) return;
    setBusy(true);
    const result = await removeCustomAssignedScreen(customScreen.id);
    setBusy(false);
    if (!result.ok) {
      showToast(result.error ?? "تعذر الحذف.", "error");
      return;
    }
    showToast("تم حذف الشاشة.", "success");
    invalidateCustomAssignedScreensQueries(queryClient);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4">
      <header className="border-b border-border pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-text">{screen.name}</h3>
            {screen.whereToFind ? (
              <p className="mt-1.5 text-xs text-text-2">{screen.whereToFind}</p>
            ) : null}
          </div>
          {isCustomScreen && canManageAccess ? (
            <div className="flex shrink-0 gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={busy}
                onClick={() =>
                  router.push(`/settings/custom-screen/${customScreenId}/edit`)
                }
              >
                تصميم
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={busy}
                disabled={busy}
                onClick={() => void handleDeleteCustomScreen()}
              >
                حذف
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <dl className="mt-4 space-y-3 text-xs">
        <div>
          <dt className="text-text-3">التصنيف</dt>
          <dd className="mt-0.5 text-text">{screen.group}</dd>
        </div>
        <div>
          <dt className="text-text-3">نوع الشاشة</dt>
          <dd className="mt-0.5">
            <Badge tone="info">{SCREEN_CATALOG_KIND_LABELS[screen.kind]}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-text-3">الحالة</dt>
          <dd className="mt-0.5">
            <Badge
              tone={
                screen.status === "جاهزة"
                  ? "success"
                  : "warning"
              }
            >
              {SCREEN_CATALOG_STATUS_LABELS[screen.status]}
            </Badge>
          </dd>
        </div>
        {screen.breadcrumb ? (
          <div>
            <dt className="text-text-3">مسار التنقل في أعلى الصفحة</dt>
            <dd className="mt-0.5 text-text">{screen.breadcrumb}</dd>
          </div>
        ) : null}
        {screen.notes ? (
          <div>
            <dt className="text-text-3">ملاحظة</dt>
            <dd className="mt-0.5 text-text-2">{screen.notes}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-text-3">الرابط التقني (للدعم الفني)</dt>
          <dd className="mt-0.5 font-mono text-[11px] text-text-3" dir="ltr">
            {humanizeScreenPath(screen.path)}
          </dd>
        </div>
      </dl>

      <section className="mt-5 border-t border-border pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-text">
              من يصل لهذه الشاشة؟ ({screen.roles.length + extraUsers.length})
            </h4>
            <p className="mt-1 text-[11px] text-text-3">
              {isCustomScreen
                ? "المستخدمون المسندون لهذه الشاشة المخصصة"
                : "الأدوار حسب صلاحيات النظام، والمستخدمون الإضافيون عبر الإسناد المخصص"}
            </p>
          </div>
          {canManageAccess ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setAccessModalOpen(true)}
            >
              تعديل المستخدمين
            </Button>
          ) : null}
        </div>
        <div className="mt-3 space-y-3">
          {!isCustomScreen
            ? Object.entries(rolesByGroup)
                .sort(([a], [b]) => a.localeCompare(b, "ar"))
                .map(([group, roleIds]) => (
                  <div key={group}>
                    <p className="mb-1.5 text-[10px] font-medium text-text-3">
                      {group} — أدوار
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {roleIds.map((roleId) => (
                        <li
                          key={roleId}
                          className={cn(
                            "rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[11px] text-text",
                          )}
                        >
                          {screenCatalogRoleLabel(roleId)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
            : null}
          {extraUsers.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[10px] font-medium text-text-3">
                {isCustomScreen
                  ? `المستخدمون (${extraUsers.length})`
                  : `مستخدمون إضافيون (${extraUsers.length})`}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {extraUsers.map((user) => (
                  <li
                    key={user.id}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 ps-2.5 pe-1 py-0.5 text-[11px] text-text"
                  >
                    <span>{user.displayName}</span>
                    {canManageAccess ? (
                      <button
                        type="button"
                        className="rounded-full px-1 text-[12px] leading-none text-danger hover:bg-danger/10"
                        title={`إزالة ${user.displayName}`}
                        disabled={busy}
                        onClick={() =>
                          void handleRemoveUser(user.id, user.displayName)
                        }
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : canManageAccess ? (
            <p className="text-[11px] text-text-3">
              {isCustomScreen
                ? "لا يوجد مستخدمون مسندون بعد. اضغط «تعديل المستخدمين» لإضافتهم."
                : "لا يوجد مستخدمون إضافيون بعد. اضغط «تعديل المستخدمين» لإضافة من خارج الأدوار الافتراضية."}
            </p>
          ) : null}
        </div>
      </section>

      {accessModalOpen && (pageId || customScreen) ? (
        <ScreenCatalogUserAccessModal
          key={`${pageId ?? customScreenId}-${extraUserIds.join(",")}`}
          screenName={screen.name}
          users={assignableUsers}
          initialUserIds={extraUserIds}
          busy={busy}
          onSave={(assignedUserIds) => void handleSaveAccess(assignedUserIds)}
          onClearAll={() => void handleSaveAccess([])}
          onClose={() => {
            if (busy) return;
            setAccessModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
