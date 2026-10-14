"use client";

/**
 * Users-screen workflow: staff list query + filters, the add-user form,
 * per-row actions (edit / disable / reactivate / unlock) and the
 * dialogs they open. Pure rules live in `users-organization-state.ts`.
 */

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RoleId } from "@platform/types";
import type {
  OrganizationValuerRosterEntry,
  UpdateStaffUserRequest,
} from "@platform/api-client";
import {
  ensureOrganizationSettingsLoaded,
  getCachedOrganizationSettings,
} from "@platform/app-shared/organization/organization-settings-cache";
import { useCapability } from "@platform/app-shared/components/Can";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import { getAuthSession } from "@platform/auth-client";
import { useToast } from "@platform/ui-kit";
import type { ConfirmActionSpec } from "../../components/ConfirmActionModal";
import { refreshOrgCache } from "../../lib/org-settings-ui";
import {
  submitCreateStaffUser,
  submitDeleteStaffUser,
  submitSyncStaffValuer,
  submitUnlockStaffUser,
  submitUpdateStaffUser,
} from "../../lib/users-api";
import { useStaffUsersQuery } from "../../query/settings-queries";
import {
  applyRoleChange,
  buildCreateStaffUserPayload,
  canDeleteUser,
  createUserErrorMessage,
  defaultReportRole,
  deleteUserErrorMessage,
  disableUserConfirmCopy,
  EMPTY_STAFF_FORM,
  filterStaffUsers,
  PROTECTED_ACCOUNT_TOAST,
  professionalToSyncFields,
  reactivateErrorMessage,
  rosterRowFor,
  saveEditErrors,
  staffValuerSyncMode,
  unlockErrorMessage,
  USER_TOASTS,
  validateStaffForm,
  withoutFieldError,
  withoutRoleErrors,
  type StaffFormState,
  type StaffProfessional,
  type StaffReportSeat,
  type StaffStatusFilter,
} from "./users-organization-state";

export type UsersOrganizationWorkflow = ReturnType<typeof useUsersOrganizationWorkflow>;

export function useUsersOrganizationWorkflow() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const canManage = useCapability("manage-users");
  const currentUserId = getAuthSession()?.user.id ?? null;
  const { data, isPending } = useStaffUsersQuery();
  const users = useMemo(() => data?.users ?? [], [data]);
  const loadError = data?.loadError ?? null;

  const [form, setForm] = useState<StaffFormState>(EMPTY_STAFF_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<StaffUser | null>(null);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StaffStatusFilter>("all");
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmActionSpec | null>(null);
  /** Roster rows (professional data) keyed by account — the users screen edits them through the sync endpoint. */
  const [valuers, setValuers] = useState<OrganizationValuerRosterEntry[]>([]);
  useEffect(() => {
    void ensureOrganizationSettingsLoaded()
      .then((settings) => setValuers(settings?.valuers ?? []))
      .catch(() => undefined);
  }, []);
  const [createdUser, setCreatedUser] = useState<{
    id: string;
    userName: string;
    mobile: string;
  } | null>(null);

  // Input stays immediate; filtering is deferred one frame — pure local filter (rerender-use-deferred-value).
  const deferredSearch = useDeferredValue(search);

  const filteredUsers = useMemo(
    () => filterStaffUsers(users, deferredSearch, statusFilter),
    [users, deferredSearch, statusFilter],
  );

  // Invalidation already refetches the active query — an extra refetch was a duplicate GET.
  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: appDataKeys.staffUsers() });

  /**
   * Carries the account into the valuers roster. With `professional` the card's fields are
   * sent; otherwise only the seat (an existing row keeps its own). Nothing is sent for an
   * account that has no row and no seat.
   */
  async function syncValuerRoster(opts: {
    id: string;
    displayName: string;
    status?: string | null;
    roleId?: string | null;
    professional?: StaffProfessional;
  }): Promise<void> {
    const row = rosterRowFor(valuers, opts.id);
    const seat: StaffReportSeat = opts.professional
      ? opts.professional.reportRole
      : row
        ? row.role === "certified"
          ? "certified"
          : "valuer"
        : defaultReportRole(opts.roleId);
    if (!row && !opts.professional && seat === "none") return;
    const ok = await submitSyncStaffValuer({
      userId: opts.id,
      displayName: opts.displayName,
      mode: staffValuerSyncMode(opts.status),
      ...(opts.professional
        ? professionalToSyncFields(opts.professional)
        : seat === "certified" || row
          ? {}
          : { reportRole: seat }),
    });
    if (!ok) {
      showToast(USER_TOASTS.rosterSyncFailed, "error");
      return;
    }
    await refreshOrgCache().catch(() => undefined);
    setValuers(getCachedOrganizationSettings()?.valuers ?? []);
  }

  function updateField<K extends keyof StaffFormState>(key: K, value: StaffFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => withoutFieldError(prev, key));
  }

  function changeRole(roleId: RoleId | "") {
    setForm((prev) => applyRoleChange(prev, roleId));
    setErrors((prev) => withoutRoleErrors(prev));
  }

  function openAdd() {
    setCreatedUser(null);
    setErrors({});
    setAdding(true);
  }

  function closeAdd() {
    setAdding(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientErrors = validateStaffForm(form);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSaving(true);
    setCreatedUser(null);
    try {
      const result = await submitCreateStaffUser(buildCreateStaffUserPayload(form));

      if (!result.ok) {
        if (result.kind === "validation" && result.errors) {
          setErrors(result.errors);
          return;
        }
        showToast(createUserErrorMessage(result), "error");
        return;
      }

      const mobile = form.mobile.trim();
      setForm(EMPTY_STAFF_FORM);
      setErrors({});
      setCreatedUser({
        id: result.result.user.id,
        userName: result.result.userName,
        mobile,
      });
      setAdding(true);
      await invalidateUsers();
      showToast(USER_TOASTS.created, "success");
      await syncValuerRoster({
        id: result.result.user.id,
        displayName: result.result.user.displayName,
        roleId: result.result.user.roleId,
        status: result.result.user.status,
      });
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteUser(user: StaffUser) {
    setDeletingId(user.id);
    try {
      const result = await submitDeleteStaffUser(user.id);
      if (!result.ok) {
        showToast(deleteUserErrorMessage(result), "error");
        return;
      }
      await invalidateUsers();
      showToast(USER_TOASTS.disabled, "success");
      await syncValuerRoster({
        id: user.id,
        displayName: user.name,
        roleId: user.roleId,
        status: "Disabled",
      });
    } finally {
      setDeletingId(null);
    }
  }

  /** Returns field errors for the modal to render, or null once the update succeeded. */
  async function onSaveEdit(
    userId: string,
    patch: UpdateStaffUserRequest,
    professional?: StaffProfessional,
  ): Promise<FieldErrors | null> {
    setPendingActionId(userId);
    try {
      const before = users.find((row) => row.id === userId);
      let displayName = before?.name ?? "";
      let status: string | null | undefined = before?.status;
      let roleId: string | null | undefined = before?.roleId;
      if (Object.keys(patch).length > 0) {
        const result = await submitUpdateStaffUser(userId, patch);
        if (!result.ok) return saveEditErrors(result);
        displayName = result.user.displayName;
        status = result.user.status;
        roleId = result.user.roleId;
      }

      setEditingUser(null);
      await invalidateUsers();
      showToast(USER_TOASTS.edited, "success");
      await syncValuerRoster({ id: userId, displayName, status, roleId, professional });
      return null;
    } finally {
      setPendingActionId(null);
    }
  }

  async function onReactivateUser(user: StaffUser) {
    setPendingActionId(user.id);
    try {
      const result = await submitUpdateStaffUser(user.id, { status: "Active" });
      if (!result.ok) {
        showToast(reactivateErrorMessage(result), "error");
        return;
      }
      await invalidateUsers();
      showToast(USER_TOASTS.reactivated, "success");
      await syncValuerRoster({
        id: result.user.id,
        displayName: result.user.displayName,
        roleId: result.user.roleId,
        status: result.user.status,
      });
    } finally {
      setPendingActionId(null);
    }
  }

  async function onUnlockUser(user: { id: string; name: string }) {
    setPendingActionId(user.id);
    try {
      const result = await submitUnlockStaffUser(user.id);
      if (!result.ok) {
        showToast(unlockErrorMessage(result), "error");
        return;
      }
      await invalidateUsers();
      showToast(USER_TOASTS.unlocked, "success");
    } finally {
      setPendingActionId(null);
    }
  }

  /** Row action: disable (after confirm) / reactivate / unlock / activate pending. */
  function onToggleUser(user: StaffUser) {
    if (user.status === "Active") {
      if (!canDeleteUser(user, currentUserId)) {
        showToast(PROTECTED_ACCOUNT_TOAST, "error");
        return;
      }
      setConfirm({
        ...disableUserConfirmCopy(user.name),
        onConfirm: () => void onDeleteUser(user),
      });
      return;
    }
    if (user.status === "Locked") {
      void onUnlockUser(user);
      return;
    }
    // Disabled or legacy PendingActivation — enable for phone login.
    void onReactivateUser(user);
  }

  function isRowBusy(user: StaffUser): boolean {
    return deletingId === user.id || pendingActionId === user.id;
  }

  return {
    canManage,
    currentUserId,
    users,
    valuers,
    loadError,
    isPending,
    filteredUsers,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    form,
    errors,
    saving,
    updateField,
    changeRole,
    adding,
    openAdd,
    closeAdd,
    onSubmit,
    createdUser,
    profileUser,
    setProfileUser,
    editingUser,
    setEditingUser,
    pendingActionId,
    onSaveEdit,
    onToggleUser,
    isRowBusy,
    confirm,
    closeConfirm: () => setConfirm(null),
  };
}
