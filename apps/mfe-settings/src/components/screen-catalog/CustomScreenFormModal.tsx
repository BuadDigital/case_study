"use client";

import { useMemo, useState } from "react";
import type { CustomAssignedScreen } from "@platform/types";
import {
  Button,
  Input,
  Label,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Select,
  cn,
} from "@platform/design-system";
import {
  ALL_PROTOTYPE_PAGES,
  PAGE_TITLES,
} from "@platform/app-shared/prototype/constants";
import type { CustomAssignedScreenUser } from "@platform/types";

const DEFAULT_ICON =
  "M4 5h16v4H4zM4 13h10v6H4zM16 13h4v6h-4z";

const DYNAMIC_PAGE_VALUE = "";

const PAGE_OPTIONS = [...ALL_PROTOTYPE_PAGES]
  .sort((a, b) =>
    (PAGE_TITLES[a] ?? a).localeCompare(PAGE_TITLES[b] ?? b, "ar"),
  )
  .map((pageId) => ({
    pageId,
    label: PAGE_TITLES[pageId] ?? pageId,
  }));

function linkedScreenDisplayName(pageId: string): string {
  return PAGE_TITLES[pageId as keyof typeof PAGE_TITLES] ?? pageId;
}

type Props = {
  users: CustomAssignedScreenUser[];
  initial?: CustomAssignedScreen | null;
  /** Pre-select a system page when creating a new assignment. */
  defaultTargetPageId?: string;
  onSave: (payload: {
    name: string;
    targetPageId: string | null;
    iconPath: string | null;
    isActive: boolean;
    assignedUserIds: string[];
  }) => void;
  onClose: () => void;
  busy?: boolean;
};

export function CustomScreenFormModal({
  users,
  initial,
  defaultTargetPageId,
  onSave,
  onClose,
  busy = false,
}: Props) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [targetPageId, setTargetPageId] = useState(
    initial?.targetPageId?.trim()
      ?? defaultTargetPageId?.trim()
      ?? DYNAMIC_PAGE_VALUE,
  );
  const isLinkedScreen = targetPageId.trim().length > 0;
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(
    () => new Set(initial?.assignedUserIds ?? []),
  );
  const [userQuery, setUserQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const visibleUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (user) =>
        user.displayName.toLowerCase().includes(q) ||
        user.userName.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q),
    );
  }, [users, userQuery]);

  function toggleUser(userId: string): void {
    setSelectedUsers((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function handleSubmit(): void {
    if (busy) return;
    const resolvedName = isLinkedScreen
      ? linkedScreenDisplayName(targetPageId.trim())
      : name.trim();
    if (!resolvedName) {
      setError(
        isLinkedScreen ? "اختر شاشة نظام من القائمة." : "اسم الشاشة مطلوب.",
      );
      return;
    }
    setError(null);
    onSave({
      name: resolvedName,
      targetPageId: targetPageId.trim() || null,
      iconPath: DEFAULT_ICON,
      isActive,
      assignedUserIds: [...selectedUsers],
    });
  }

  return (
    <ModalOverlay onClick={busy ? undefined : onClose}>
      <ModalCard
        className="max-w-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalHeader>
          <ModalTitle>
            {isEdit ? "تعديل شاشة مخصصة" : "إضافة شاشة للمستخدمين"}
          </ModalTitle>
        </ModalHeader>
        <div className="space-y-4 px-5 py-4">
          <div>
            <Label htmlFor="custom-screen-target">نوع الشاشة</Label>
            <Select
              id="custom-screen-target"
              value={targetPageId}
              onChange={(event) => setTargetPageId(event.target.value)}
            >
              <option value={DYNAMIC_PAGE_VALUE}>شاشة ديناميكية جديدة</option>
              {PAGE_OPTIONS.map((option) => (
                <option key={option.pageId} value={option.pageId}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-[11px] text-text-3">
              {isLinkedScreen
                ? `سيظهر في القائمة باسم «${linkedScreenDisplayName(targetPageId)}» — نفس اسم شاشة النظام.`
                : "تُنشأ فارغة. بعد الحفظ استخدم «تصميم» لإضافة الحقول والتخطيط."}
            </p>
          </div>
          {!isLinkedScreen ? (
            <div>
              <Label htmlFor="custom-screen-name">اسم الشاشة في القائمة</Label>
              <Input
                id="custom-screen-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="مثال: تقارير الأداء"
              />
            </div>
          ) : null}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-text">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            نشطة (تظهر في القائمة الجانبية)
          </label>
          <div>
            <Label>المستخدمون المسند إليهم (اختياري)</Label>
            <Input
              value={userQuery}
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder="ابحث بالاسم أو اسم الدخول…"
              className="mb-2"
            />
            <div className="max-h-48 overflow-y-auto rounded border border-border">
              {visibleUsers.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-text-3">
                  لا يوجد مستخدمون مطابقون
                </p>
              ) : (
                visibleUsers.map((user) => (
                  <label
                    key={user.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 border-b border-border px-3 py-2 text-xs last:border-b-0 hover:bg-surface-2",
                      selectedUsers.has(user.id) && "bg-primary/5",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleUser(user.id)}
                    />
                    <span>
                      <span className="block font-medium text-text">
                        {user.displayName}
                      </span>
                      <span className="text-[11px] text-text-3">
                        {user.userName} — {user.email}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
            {selectedUsers.size > 0 ? (
              <p className="mt-1.5 text-[11px] text-text-3">
                {selectedUsers.size} مستخدم محدد
              </p>
            ) : null}
          </div>
          {error ? (
            <p className="text-xs text-danger">{error}</p>
          ) : null}
        </div>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={busy}
            disabled={busy}
            onClick={handleSubmit}
          >
            {isEdit ? "حفظ التعديلات" : "إضافة الشاشة"}
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
