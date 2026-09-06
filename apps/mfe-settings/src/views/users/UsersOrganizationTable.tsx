"use client";

/**
 * Users screen list region: search + status filter toolbar and the staff
 * table with per-row edit / status actions.
 */

import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  Spinner,
  Table,
  TableEmptyRow,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
} from "@platform/ui-kit";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  deptLabel,
  emptyUsersMessage,
  formatLastLogin,
  statusLabel,
  statusTone,
  userToggleLabel,
  type StaffStatusFilter,
} from "./users-organization-state";
import type { UsersOrganizationWorkflow } from "./useUsersOrganizationWorkflow";

// Prefetch on hover/focus — without it the user waits for the bundle after click
// (bundle-preload). Row buttons are usually hovered before click.
export const preloadEditStaffUserModal = () =>
  void import("../../components/EditStaffUserModal");
export const preloadUserProfileModal = () =>
  void import("../../components/UserProfileModal");

export function UsersOrganizationToolbar({
  workflow,
}: {
  workflow: UsersOrganizationWorkflow;
}) {
  const { canManage, search, setSearch, statusFilter, setStatusFilter, openAdd } = workflow;
  return (
    <div className="mb-3 flex flex-wrap gap-2.5">
      <Input
        className="h-[34px] max-w-[260px] py-0 text-[12.5px] leading-[34px]"
        placeholder="بحث بالاسم…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Select
        className="h-[34px] max-w-[170px] py-0 text-[12.5px] leading-[34px]"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as StaffStatusFilter)}
      >
        <option value="all">كل الحالات</option>
        <option value="on">نشط</option>
        <option value="off">معطّل</option>
      </Select>
      {canManage ? (
        <Button variant="default" onClick={openAdd}>
          إضافة مستخدم
        </Button>
      ) : null}
    </div>
  );
}

function StaffUserRow({
  user,
  workflow,
}: {
  user: StaffUser;
  workflow: UsersOrganizationWorkflow;
}) {
  const { canManage, issuingTicketFor, isRowBusy, setProfileUser, setEditingUser, onToggleUser } =
    workflow;
  const busy = isRowBusy(user) || issuingTicketFor === user.id;
  return (
    <Tr hoverable={false}>
      <Td className="font-medium">
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-start font-medium text-inherit hover:text-gold-d"
          onClick={() => setProfileUser(user)}
          onMouseEnter={preloadUserProfileModal}
          onFocus={preloadUserProfileModal}
        >
          {user.name}
        </button>
        {/* Numbering workshop (bit item 5): reference number is shown, not hidden. */}
        {user.referenceNumber ? (
          <span className="block text-[10px] text-text-3" dir="ltr">
            {user.referenceNumber}
          </span>
        ) : null}
      </Td>
      <Td>{user.role}</Td>
      <Td>{deptLabel(user)}</Td>
      <TdLtr bare>{formatLastLogin(user.lastLoginAtUtc)}</TdLtr>
      <Td>
        <Badge tone={statusTone(user.status)}>{statusLabel(user.status)}</Badge>
      </Td>
      <Td className="whitespace-nowrap">
        {canManage ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingUser(user)}
              onMouseEnter={preloadEditStaffUserModal}
              onFocus={preloadEditStaffUserModal}
            >
              تعديل
            </Button>{" "}
            <Button
              variant="ghost"
              size="sm"
              loading={busy}
              disabled={busy}
              onClick={() => onToggleUser(user)}
            >
              {userToggleLabel(user.status)}
            </Button>
          </>
        ) : null}
      </Td>
    </Tr>
  );
}

export function UsersOrganizationTable({
  workflow,
}: {
  workflow: UsersOrganizationWorkflow;
}) {
  const { users, isPending, filteredUsers } = workflow;
  return (
    <Card className="overflow-hidden">
      {isPending && users.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-3">
          <Spinner />
          <span className="text-[13px]">جاري التحميل…</span>
        </div>
      ) : (
        <Table className="tabular-nums">
          <THead>
            <Tr hoverable={false}>
              <Th>الاسم</Th>
              <Th>الدور</Th>
              <Th>القسم</Th>
              <Th>آخر دخول</Th>
              <Th>الحالة</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {filteredUsers.length === 0 ? (
              <TableEmptyRow colSpan={6}>{emptyUsersMessage(users.length)}</TableEmptyRow>
            ) : (
              filteredUsers.map((user) => (
                <StaffUserRow key={user.id} user={user} workflow={workflow} />
              ))
            )}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
