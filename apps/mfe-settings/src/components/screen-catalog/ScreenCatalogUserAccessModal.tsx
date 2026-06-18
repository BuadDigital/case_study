"use client";

import { useMemo, useState } from "react";
import type { CustomAssignedScreenUser } from "@platform/types";
import {
  Button,
  Input,
  Label,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  cn,
} from "@platform/design-system";

type Props = {
  screenName: string;
  users: CustomAssignedScreenUser[];
  initialUserIds: string[];
  busy?: boolean;
  onSave: (assignedUserIds: string[]) => void;
  onClearAll?: () => void;
  onClose: () => void;
};

export function ScreenCatalogUserAccessModal({
  screenName,
  users,
  initialUserIds,
  busy = false,
  onSave,
  onClearAll,
  onClose,
}: Props) {
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(
    () => new Set(initialUserIds),
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
    setError(null);
    onSave([...selectedUsers]);
  }

  return (
    <ModalOverlay onClick={busy ? undefined : onClose}>
      <ModalCard
        className="max-w-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalHeader>
          <ModalTitle>إسناد مستخدمين — {screenName}</ModalTitle>
        </ModalHeader>
        <div className="space-y-4 px-5 py-4">
          <p className="text-[11px] text-text-3">
            يظهر لهم اختصار هذه الشاشة في القائمة الجانبية مع صلاحية الدخول
            والبيانات. أزل التحديد لإلغاء الإسناد.
          </p>
          <div>
            <Label>المستخدمون</Label>
            <Input
              value={userQuery}
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder="ابحث بالاسم أو اسم الدخول…"
              className="mb-2"
            />
            <div className="max-h-56 overflow-y-auto rounded border border-border">
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
                      disabled={busy}
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
            <p className="mt-1.5 text-[11px] text-text-3">
              {selectedUsers.size} مستخدم محدد — أزل التحديد أو اضغط × لإلغاء
              الإسناد
            </p>
            {selectedUsers.size > 0 && onClearAll ? (
              <button
                type="button"
                className="mt-2 text-[11px] text-danger underline-offset-2 hover:underline"
                disabled={busy}
                onClick={onClearAll}
              >
                إزالة جميع المستخدمين من هذه الشاشة
              </button>
            ) : null}
          </div>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
            <Button
            type="button"
            variant="primary"
            loading={busy}
            onClick={handleSubmit}
            disabled={busy}
          >
            حفظ الإسناد
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
