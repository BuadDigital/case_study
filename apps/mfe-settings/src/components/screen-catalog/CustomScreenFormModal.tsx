"use client";

import { useMemo, useState } from "react";
import type { PageId } from "@platform/types";
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

const EMPTY_PAGE_VALUE = "";

const PAGE_OPTIONS = [...ALL_PROTOTYPE_PAGES]
  .sort((a, b) =>
    (PAGE_TITLES[a] ?? a).localeCompare(PAGE_TITLES[b] ?? b, "ar"),
  )
  .map((pageId) => ({
    pageId,
    label: PAGE_TITLES[pageId] ?? pageId,
  }));

type Props = {
  users: CustomAssignedScreenUser[];
  initial?: CustomAssignedScreen | null;
  onSave: (payload: {
    name: string;
    targetPageId: string | null;
    iconPath: string | null;
    isActive: boolean;
    assignedUserIds: string[];
  }) => void;
  onClose: () => void;
};

export function CustomScreenFormModal({
  users,
  initial,
  onSave,
  onClose,
}: Props) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [targetPageId, setTargetPageId] = useState(
    initial?.targetPageId?.trim() ?? EMPTY_PAGE_VALUE,
  );
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
    const trimmed = name.trim();
    if (!trimmed) {
      setError("اسم الشاشة مطلوب.");
      return;
    }
    if (selectedUsers.size === 0) {
      setError("اختر مستخدماً واحداً على الأقل.");
      return;
    }
    setError(null);
    onSave({
      name: trimmed,
      targetPageId: targetPageId.trim() || null,
      iconPath: DEFAULT_ICON,
      isActive,
      assignedUserIds: [...selectedUsers],
    });
  }

  return (
    <ModalOverlay onClick={onClose}>
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
            <Label htmlFor="custom-screen-name">اسم الشاشة في القائمة</Label>
            <Input
              id="custom-screen-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="مثال: تقارير الأداء"
            />
          </div>
          {!isEdit ? (
            <p className="rounded border border-border bg-surface-2 px-3 py-2 text-[11px] text-text-3">
              تُنشأ الشاشة فارغة. يمكن ربطها بصفحة لاحقاً من «تعديل».
            </p>
          ) : (
            <div>
              <Label htmlFor="custom-screen-target">الصفحة المرتبطة (اختياري)</Label>
              <Select
                id="custom-screen-target"
                value={targetPageId}
                onChange={(event) => setTargetPageId(event.target.value)}
              >
                <option value={EMPTY_PAGE_VALUE}>فارغة — بدون محتوى</option>
                {PAGE_OPTIONS.map((option) => (
                  <option key={option.pageId} value={option.pageId}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-[11px] text-text-3">
                اتركها فارغة حتى يُبنى محتوى الشاشة لاحقاً.
              </p>
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-text">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            نشطة (تظهر في القائمة الجانبية)
          </label>
          <div>
            <Label>المستخدمون المسند إليهم</Label>
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
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit}>
            {isEdit ? "حفظ التعديلات" : "إضافة الشاشة"}
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
