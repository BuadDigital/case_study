"use client";

/**
 * Users screen — composition only. Workflow lives in
 * `useUsersOrganizationWorkflow`; regions: `UsersOrganizationToolbar`,
 * `UsersOrganizationTable`, `AddStaffUserModal`, the lazy edit / profile
 * modals and the shared `ConfirmActionModal`.
 */

import dynamic from "next/dynamic";
import { Note, PageShell } from "@platform/ui-kit";
import { ConfirmActionModal } from "../../components/ConfirmActionModal";
import { DevSystemResetPanel } from "../../components/DevSystemResetPanel";
import { AddStaffUserModal } from "./AddStaffUserModal";
import { useUsersOrganizationWorkflow } from "./useUsersOrganizationWorkflow";
import { UsersOrganizationTable, UsersOrganizationToolbar } from "./UsersOrganizationTable";

const EditStaffUserModal = dynamic(
  () =>
    import("../../components/EditStaffUserModal").then(
      (m) => m.EditStaffUserModal,
    ),
  { ssr: false },
);
const UserProfileModal = dynamic(
  () =>
    import("../../components/UserProfileModal").then((m) => m.UserProfileModal),
  { ssr: false },
);

export function UsersOrganizationView() {
  const workflow = useUsersOrganizationWorkflow();
  const {
    canManage,
    loadError,
    adding,
    profileUser,
    setProfileUser,
    editingUser,
    setEditingUser,
    pendingActionId,
    onSaveEdit,
    confirm,
    closeConfirm,
  } = workflow;

  return (
    <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
      {!canManage ? (
        <Note tone="warn" className="mb-3 max-w-[560px]">
          الرابط صحيح، لكن دورك الحالي لا يملك صلاحية هذا البند. اطلب الصلاحية من مسؤول النظام.
        </Note>
      ) : null}
      {loadError ? <Note tone="warn">{loadError}</Note> : null}

      <UsersOrganizationToolbar workflow={workflow} />
      <UsersOrganizationTable workflow={workflow} />
      <p className="mx-0.5 mt-2.5 text-[11.5px] text-text-3">
        ٨ أدوار معرّفة مسبقاً بصلاحياتها — تحرير الأدوار نفسها غير متاح في هذه المرحلة.
      </p>

      <div className="mt-6">
        <DevSystemResetPanel />
      </div>

      {adding ? <AddStaffUserModal workflow={workflow} /> : null}

      {profileUser ? (
        <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />
      ) : null}

      {editingUser ? (
        <EditStaffUserModal
          user={editingUser}
          saving={pendingActionId === editingUser.id}
          onSubmit={(patch) => onSaveEdit(editingUser.id, patch)}
          onClose={() => setEditingUser(null)}
        />
      ) : null}

      <ConfirmActionModal
        modal={confirm}
        titleId="users-confirm-title"
        onClose={closeConfirm}
      />
    </PageShell>
  );
}
