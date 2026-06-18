"use client";

import { useEffect, useMemo, useState } from "react";
import type { CustomAssignedScreenUser } from "@platform/types";
import type { RoleId } from "@platform/types";
import {
  screenCatalogRoleGroup,
  screenCatalogRoleLabel,
} from "@platform/app-shared/prototype/screen-catalog";
import {
  Badge,
  Button,
  Input,
  Label,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  cn,
  useToast,
} from "@platform/design-system";

const UNASSIGNED_ROLE = "__unassigned__";

type Props = {
  screenName: string;
  users: CustomAssignedScreenUser[];
  screenRoleIds?: RoleId[];
  isCustomScreen?: boolean;
  initialUserIds: string[];
  initialExcludedUserIds?: string[];
  busy?: boolean;
  assignedUsers?: CustomAssignedScreenUser[];
  /** Signed-in user — cannot hide screens from themselves (CDO lockout guard). */
  currentUserId?: string | null;
  onSave: (
    assignedUserIds: string[],
    options?: {
      keepOpen?: boolean;
      successMessage?: string;
      excludedUserIds?: string[];
    },
  ) => void;
  onClearAll?: () => void;
  onClose: () => void;
};

function userRoleKey(user: CustomAssignedScreenUser): string {
  const role = user.prototypeRole?.trim().toLowerCase();
  return role && role.length > 0 ? role : UNASSIGNED_ROLE;
}

export function ScreenCatalogUserAccessModal({
  screenName,
  users,
  screenRoleIds = [],
  isCustomScreen = false,
  initialUserIds,
  initialExcludedUserIds = [],
  assignedUsers = [],
  currentUserId = null,
  busy = false,
  onSave,
  onClearAll,
  onClose,
}: Props) {
  const { showToast } = useToast();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(
    () => new Set(initialUserIds),
  );
  const [excludedUsers, setExcludedUsers] = useState<Set<string>>(
    () => new Set(initialExcludedUserIds),
  );
  const [userQuery, setUserQuery] = useState("");
  const [activeRoleKey, setActiveRoleKey] = useState<string | null>(null);

  const userById = useMemo(() => {
    const map = new Map<string, CustomAssignedScreenUser>();
    for (const user of [...users, ...assignedUsers]) {
      map.set(user.id, user);
    }
    return map;
  }, [users, assignedUsers]);

  useEffect(() => {
    setSelectedUsers(new Set(initialUserIds));
  }, [initialUserIds]);

  useEffect(() => {
    setExcludedUsers(new Set(initialExcludedUserIds));
  }, [initialExcludedUserIds]);

  const roleGrantedIds = useMemo(() => {
    if (isCustomScreen || screenRoleIds.length === 0) return new Set<string>();
    return new Set(
      users
        .filter((user) => {
          const role = user.prototypeRole?.trim().toLowerCase();
          return role && screenRoleIds.includes(role as RoleId);
        })
        .map((user) => user.id),
    );
  }, [users, screenRoleIds, isCustomScreen]);

  function isUserVisible(userId: string): boolean {
    if (isCustomScreen) return selectedUsers.has(userId);
    if (excludedUsers.has(userId)) return false;
    return roleGrantedIds.has(userId) || selectedUsers.has(userId);
  }

  const usersByRole = useMemo(() => {
    const map = new Map<string, CustomAssignedScreenUser[]>();
    for (const user of users) {
      const key = userRoleKey(user);
      const list = map.get(key) ?? [];
      list.push(user);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.displayName.localeCompare(b.displayName, "ar"));
    }
    return map;
  }, [users]);

  const roleKeys = useMemo(() => {
    const keys = new Set(usersByRole.keys());
    const ordered: string[] = [];

    for (const roleId of screenRoleIds) {
      if (keys.has(roleId)) ordered.push(roleId);
    }

    const rest = [...keys]
      .filter((key) => !ordered.includes(key))
      .sort((a, b) => {
        if (a === UNASSIGNED_ROLE) return 1;
        if (b === UNASSIGNED_ROLE) return -1;
        const ga = a === UNASSIGNED_ROLE ? "zzz" : screenCatalogRoleGroup(a as RoleId);
        const gb = b === UNASSIGNED_ROLE ? "zzz" : screenCatalogRoleGroup(b as RoleId);
        const gc = ga.localeCompare(gb, "ar");
        if (gc !== 0) return gc;
        const la =
          a === UNASSIGNED_ROLE
            ? "غير مصنّف"
            : screenCatalogRoleLabel(a as RoleId);
        const lb =
          b === UNASSIGNED_ROLE
            ? "غير مصنّف"
            : screenCatalogRoleLabel(b as RoleId);
        return la.localeCompare(lb, "ar");
      });

    return [...ordered, ...rest.filter((k) => !ordered.includes(k))];
  }, [screenRoleIds, usersByRole]);

  useEffect(() => {
    if (roleKeys.length === 0) {
      setActiveRoleKey(null);
      return;
    }
    if (activeRoleKey && roleKeys.includes(activeRoleKey)) return;

    const roleWithSelection = roleKeys.find((key) =>
      (usersByRole.get(key) ?? []).some((user) => isUserVisible(user.id)),
    );
    setActiveRoleKey(roleWithSelection ?? roleKeys[0]);
  }, [roleKeys, usersByRole, selectedUsers, excludedUsers, activeRoleKey, roleGrantedIds, isCustomScreen]);

  const activeUsers = useMemo(() => {
    if (!activeRoleKey) return [];
    const q = userQuery.trim().toLowerCase();
    const list = usersByRole.get(activeRoleKey) ?? [];
    if (!q) return list;
    return list.filter(
      (user) =>
        user.displayName.toLowerCase().includes(q) ||
        user.userName.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q),
    );
  }, [activeRoleKey, usersByRole, userQuery]);

  const visibleCountInRole = useMemo(() => {
    if (!activeRoleKey) return 0;
    return (usersByRole.get(activeRoleKey) ?? []).filter((user) =>
      isUserVisible(user.id),
    ).length;
  }, [activeRoleKey, usersByRole, selectedUsers, excludedUsers, roleGrantedIds, isCustomScreen]);

  const totalVisible = useMemo(
    () => users.filter((user) => isUserVisible(user.id)).length,
    [users, selectedUsers, excludedUsers, roleGrantedIds, isCustomScreen],
  );

  function roleLabel(roleKey: string): string {
    if (roleKey === UNASSIGNED_ROLE) return "غير مصنّف";
    return screenCatalogRoleLabel(roleKey as RoleId);
  }

  function persist(
    nextSelected: Set<string>,
    nextExcluded: Set<string>,
    successMessage: string,
  ): void {
    setSelectedUsers(nextSelected);
    setExcludedUsers(nextExcluded);
    onSave([...nextSelected], {
      keepOpen: true,
      successMessage,
      excludedUserIds: [...nextExcluded],
    });
  }

  function setUserVisible(user: CustomAssignedScreenUser, visible: boolean): void {
    if (
      !visible &&
      currentUserId &&
      user.id === currentUserId &&
      !isCustomScreen
    ) {
      showToast("لا يمكنك إخفاء الشاشة عن نفسك — اطلب من مسؤول آخر إن لزم.", "info");
      return;
    }

    const nextSelected = new Set(selectedUsers);
    const nextExcluded = new Set(excludedUsers);
    const roleGranted = roleGrantedIds.has(user.id);

    if (isCustomScreen) {
      if (visible) nextSelected.add(user.id);
      else nextSelected.delete(user.id);
    } else if (roleGranted) {
      if (visible) nextExcluded.delete(user.id);
      else nextExcluded.add(user.id);
    } else {
      if (visible) nextSelected.add(user.id);
      else nextSelected.delete(user.id);
    }

    persist(
      nextSelected,
      nextExcluded,
      visible
        ? `«${user.displayName}» — ظهرت الشاشة في قائمته.`
        : `«${user.displayName}» — أُخفيت الشاشة من قائمته.`,
    );
  }

  function toggleUser(user: CustomAssignedScreenUser): void {
    setUserVisible(user, !isUserVisible(user.id));
  }

  function selectAllInRole(): void {
    if (!activeRoleKey) return;
    const nextSelected = new Set(selectedUsers);
    const nextExcluded = new Set(excludedUsers);
    let changed = 0;

    for (const user of usersByRole.get(activeRoleKey) ?? []) {
      if (currentUserId && user.id === currentUserId) continue;
      if (roleGrantedIds.has(user.id)) {
        if (nextExcluded.delete(user.id)) changed += 1;
      } else if (!nextSelected.has(user.id)) {
        nextSelected.add(user.id);
        changed += 1;
      }
    }

    if (changed === 0) return;
    persist(
      nextSelected,
      nextExcluded,
      `ظهرت الشاشة لـ ${changed} مستخدمين في هذا الدور.`,
    );
  }

  function hideAllInRole(): void {
    if (!activeRoleKey) return;
    const nextSelected = new Set(selectedUsers);
    const nextExcluded = new Set(excludedUsers);
    let changed = 0;

    for (const user of usersByRole.get(activeRoleKey) ?? []) {
      if (currentUserId && user.id === currentUserId) continue;
      if (roleGrantedIds.has(user.id)) {
        if (!nextExcluded.has(user.id)) {
          nextExcluded.add(user.id);
          changed += 1;
        }
      } else if (nextSelected.delete(user.id)) {
        changed += 1;
      }
    }

    if (changed === 0) return;
    persist(
      nextSelected,
      nextExcluded,
      `أُخفيت الشاشة عن ${changed} مستخدمين في هذا الدور.`,
    );
  }

  const extraGrantList = useMemo(() => {
    return [...selectedUsers]
      .map((id) => userById.get(id))
      .filter((user): user is CustomAssignedScreenUser => Boolean(user))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "ar"));
  }, [selectedUsers, userById]);

  const hiddenRoleList = useMemo(() => {
    if (isCustomScreen) return [];
    return [...excludedUsers]
      .map((id) => userById.get(id))
      .filter((user): user is CustomAssignedScreenUser => Boolean(user))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "ar"));
  }, [excludedUsers, userById, isCustomScreen]);

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
          <div className="space-y-2 rounded-xl border border-border bg-surface-2 px-4 py-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-success/15 text-success">
                ✓
              </span>
              <span className="text-text-2">ظاهرة في القائمة</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-surface text-text-3">
                ○
              </span>
              <span className="text-text-2">مخفية — أزل ✓ لتختفي فوراً</span>
            </div>
            <p className="border-t border-border pt-2 text-[11px] text-text-3">
              {totalVisible} من {users.length} ظاهرة
            </p>
          </div>

          {extraGrantList.length > 0 || hiddenRoleList.length > 0 ? (
            <div className="space-y-2">
              {extraGrantList.length > 0 ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <Label className="mb-2 text-[11px] text-text-2">
                    إسناد إضافي ({extraGrantList.length})
                  </Label>
                  <ul className="flex flex-wrap gap-1.5">
                    {extraGrantList.map((user) => (
                      <li key={user.id}>
                        <button
                          type="button"
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-surface px-2 py-0.5 text-[11px] text-text hover:bg-primary/10"
                          disabled={busy}
                          onClick={() => setUserVisible(user, false)}
                        >
                          <span className="truncate">{user.displayName}</span>
                          <span className="text-danger">×</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {hiddenRoleList.length > 0 ? (
                <div className="rounded-xl border border-border bg-surface-2 px-3 py-2.5">
                  <Label className="mb-2 text-[11px] text-text-2">
                    مخفية عنهم ({hiddenRoleList.length})
                  </Label>
                  <ul className="flex flex-wrap gap-1.5">
                    {hiddenRoleList.map((user) => (
                      <li key={user.id}>
                        <button
                          type="button"
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text-2 hover:border-primary/30 hover:text-text"
                          disabled={busy}
                          onClick={() => setUserVisible(user, true)}
                        >
                          <span className="truncate">{user.displayName}</span>
                          <span className="text-primary">+</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {roleKeys.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface-2 px-3 py-6 text-center text-xs text-text-3">
              لا يوجد مستخدمون متاحون للإسناد.
            </p>
          ) : (
            <div className="flex flex-col gap-3 overflow-hidden rounded-xl border border-border shadow-sm">
              <div className="border-b border-border bg-surface-2 p-3">
                <Label className="mb-2 text-[11px] text-text-3">اختر الدور</Label>
                <nav
                  className="flex flex-col gap-1"
                  aria-label="الأدوار"
                >
                  {roleKeys.map((roleKey) => {
                    const count = usersByRole.get(roleKey)?.length ?? 0;
                    const visibleInRole = (usersByRole.get(roleKey) ?? []).filter(
                      (user) => isUserVisible(user.id),
                    ).length;
                    const isDefaultRole =
                      roleKey !== UNASSIGNED_ROLE &&
                      screenRoleIds.includes(roleKey as RoleId);

                    return (
                      <button
                        key={roleKey}
                        type="button"
                        disabled={busy}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start text-xs transition-all",
                          activeRoleKey === roleKey
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-transparent text-text-2 hover:border-border hover:bg-surface hover:text-text",
                        )}
                        onClick={() => {
                          setActiveRoleKey(roleKey);
                          setUserQuery("");
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold">
                            {roleLabel(roleKey)}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className="text-text-3">{count} مستخدم</span>
                            {visibleInRole > 0 ? (
                              <span className="text-success">
                                · {visibleInRole} ظاهرة
                              </span>
                            ) : (
                              <span className="text-text-3">· الكل مخفي</span>
                            )}
                            {isDefaultRole ? (
                              <Badge tone="info" className="text-[9px]">
                                دور افتراضي
                              </Badge>
                            ) : null}
                          </span>
                        </span>
                        {activeRoleKey === roleKey ? (
                          <span className="shrink-0 text-primary">▾</span>
                        ) : (
                          <span className="shrink-0 text-text-3">◂</span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="flex min-h-0 flex-col bg-surface p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label className="mb-0 text-sm">
                      {activeRoleKey ? roleLabel(activeRoleKey) : "المستخدمون"}
                    </Label>
                    {activeRoleKey ? (
                      <p className="mt-0.5 text-[10px] text-text-3">
                        {visibleCountInRole} ظاهرة في هذا الدور
                      </p>
                    ) : null}
                  </div>
                  {activeRoleKey ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={selectAllInRole}
                      >
                        إظهار الكل
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy || visibleCountInRole === 0}
                        onClick={hideAllInRole}
                      >
                        إخفاء الكل
                      </Button>
                    </div>
                  ) : null}
                </div>
                <Input
                  value={userQuery}
                  onChange={(event) => setUserQuery(event.target.value)}
                  placeholder="ابحث بالاسم أو اسم الدخول…"
                  className="mb-3"
                />
                <div className="max-h-[280px] min-h-0 space-y-1.5 overflow-y-auto">
                  {activeUsers.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-xs text-text-3">
                      لا يوجد مستخدمون مطابقون في هذا الدور
                    </p>
                  ) : (
                    activeUsers.map((user) => {
                      const visible = isUserVisible(user.id);
                      const roleGranted = roleGrantedIds.has(user.id);
                      return (
                        <label
                          key={user.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-start transition-colors",
                            visible
                              ? "border-success/25 bg-success/5"
                              : "border-border bg-surface-2",
                            busy && "pointer-events-none opacity-60",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="shrink-0"
                            checked={visible}
                            disabled={busy}
                            onChange={() => toggleUser(user)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium text-text">
                                {user.displayName}
                              </span>
                              {roleGranted && visible ? (
                                <Badge tone="info" className="text-[9px]">
                                  من الدور
                                </Badge>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-text-3">
                              {user.userName} · {user.email}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-[10px] font-medium",
                              visible ? "text-success" : "text-text-3",
                            )}
                          >
                            {visible ? "ظاهرة" : "مخفية"}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {(selectedUsers.size > 0 || excludedUsers.size > 0) && onClearAll ? (
            <button
              type="button"
              className="text-[11px] text-danger underline-offset-2 hover:underline"
              disabled={busy}
              onClick={onClearAll}
            >
              إعادة الكل للوضع الافتراضي (إلغاء الإسناد والإخفاء)
            </button>
          ) : null}
        </div>
        <ModalFooter>
          <Button type="button" variant="primary" onClick={onClose} disabled={busy}>
            تم
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
