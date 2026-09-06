"use client";

/**
 * Users-screen workflow: staff list query + filters, the add-user form,
 * per-row actions (edit / disable / reactivate / unlock / invite) and the
 * dialogs they open. Pure rules live in `users-organization-state.ts`.
 */

import { useDeferredValue, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RoleId } from "@platform/types";
import type { UpdateStaffUserRequest } from "@platform/api-client";
import { useCapability } from "@platform/app-shared/components/Can";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import { getAuthSession } from "@platform/auth-client";
import { useToast } from "@platform/ui-kit";
import type { ConfirmActionSpec } from "../../components/ConfirmActionModal";
import {
  requestActivationTicket,
  submitCreateStaffUser,
  submitDeleteStaffUser,
  submitUnlockStaffUser,
  submitUpdateStaffUser,
} from "../../lib/users-api";
import { useStaffUsersQuery } from "../../query/settings-queries";
import {
  activationTicketErrorMessage,
  applyRoleChange,
  buildCreateStaffUserPayload,
  canDeleteUser,
  createUserErrorMessage,
  deleteUserErrorMessage,
  disableUserConfirmCopy,
  EMPTY_STAFF_FORM,
  filterStaffUsers,
  PROTECTED_ACCOUNT_TOAST,
  reactivateErrorMessage,
  saveEditErrors,
  unlockErrorMessage,
  USER_TOASTS,
  validateStaffForm,
  withoutFieldError,
  withoutRoleErrors,
  type StaffFormState,
  type StaffStatusFilter,
} from "./users-organization-state";

export type UsersOrganizationWorkflow = ReturnType<typeof useUsersOrganizationWorkflow>;

export function useUsersOrganizationWorkflow() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const canManage = useCapability("manage-users");
  const currentUserId = getAuthSession()?.user.id ?? null;
  const { data, isPending } = useStaffUsersQuery();
  const users = data?.users ?? [];
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
  const [createdUser, setCreatedUser] = useState<{
    id: string;
    userName: string;
  } | null>(null);
  const [activationTicket, setActivationTicket] = useState<{
    userName: string;
    token: string;
    expiresAtUtc: string;
  } | null>(null);
  const [issuingTicketFor, setIssuingTicketFor] = useState<string | null>(null);

  // Input stays immediate; filtering is deferred one frame — pure local filter (rerender-use-deferred-value).
  const deferredSearch = useDeferredValue(search);

  const filteredUsers = useMemo(
    () => filterStaffUsers(users, deferredSearch, statusFilter),
    [users, deferredSearch, statusFilter],
  );

  // Invalidation already refetches the active query — an extra refetch was a duplicate GET.
  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: appDataKeys.staffUsers() });

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
    setActivationTicket(null);
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
    setActivationTicket(null);
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

      setForm(EMPTY_STAFF_FORM);
      setErrors({});
      setCreatedUser({
        id: result.result.user.id,
        userName: result.result.userName,
      });
      setAdding(true);
      await invalidateUsers();
      showToast(USER_TOASTS.created, "success");
    } finally {
      setSaving(false);
    }
  }

  async function onIssueActivationTicket(userId: string) {
    setIssuingTicketFor(userId);
    setActivationTicket(null);
    try {
      const result = await requestActivationTicket(userId);
      if (!result.ok) {
        showToast(activationTicketErrorMessage(result), "error");
        return;
      }
      setActivationTicket(result.ticket);
      setAdding(true);
      showToast(USER_TOASTS.ticketIssued, "success");
    } finally {
      setIssuingTicketFor(null);
    }
  }

  async function onDeleteUser(user: { id: string; name: string }) {
    setDeletingId(user.id);
    try {
      const result = await submitDeleteStaffUser(user.id);
      if (!result.ok) {
        showToast(deleteUserErrorMessage(result), "error");
        return;
      }
      await invalidateUsers();
      showToast(USER_TOASTS.disabled, "success");
    } finally {
      setDeletingId(null);
    }
  }

  /** Returns field errors for the modal to render, or null once the update succeeded. */
  async function onSaveEdit(
    userId: string,
    patch: UpdateStaffUserRequest,
  ): Promise<FieldErrors | null> {
    setPendingActionId(userId);
    try {
      const result = await submitUpdateStaffUser(userId, patch);
      if (!result.ok) return saveEditErrors(result);

      setEditingUser(null);
      await invalidateUsers();
      showToast(USER_TOASTS.edited, "success");
      return null;
    } finally {
      setPendingActionId(null);
    }
  }

  async function onReactivateUser(user: { id: string; name: string }) {
    setPendingActionId(user.id);
    try {
      const result = await submitUpdateStaffUser(user.id, { status: "Active" });
      if (!result.ok) {
        showToast(reactivateErrorMessage(result), "error");
        return;
      }
      await invalidateUsers();
      showToast(USER_TOASTS.reactivated, "success");
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

  /** Row action button: disable (after confirm) / reactivate / unlock / invite by status. */
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
    if (user.status === "Disabled") {
      void onReactivateUser(user);
      return;
    }
    if (user.status === "Locked") {
      void onUnlockUser(user);
      return;
    }
    void onIssueActivationTicket(user.id);
  }

  function isRowBusy(user: StaffUser): boolean {
    return deletingId === user.id || pendingActionId === user.id;
  }

  return {
    canManage,
    users,
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
    activationTicket,
    issuingTicketFor,
    onIssueActivationTicket,
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
