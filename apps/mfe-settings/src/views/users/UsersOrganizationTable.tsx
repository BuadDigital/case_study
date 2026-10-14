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
  PageLoadingHint,
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
import { todayIso } from "@platform/app-shared/format/date";
import {
  deptLabel,
  emptyUsersMessage,
  formatLastLogin,
  rosterRowFor,
  statusLabel,
  statusTone,
  userToggleLabel,
  type StaffStatusFilter,
} from "./users-organization-state";
import { reportSeatLabel, seatStatus } from "./report-seat-state";
import type { UsersOrganizationWorkflow } from "./useUsersOrganizationWorkflow";

// Prefetch on hover/focus — without it the user waits for the bundle after click
// (bundle-preload). Row buttons are usually hovered before click.
const preloadEditStaffUserModal = () =>
  void import("../../components/EditStaffUserModal");
const preloadUserProfileModal = () =>
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
        <option value="seated">يظهر في التقرير</option>
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
  const { canManage, isRowBusy, setProfileUser, setEditingUser, onToggleUser, valuers } =
    workflow;
  const busy = isRowBusy(user);
  const seat = rosterRowFor(valuers, user.id);
  const seatState = seat ? seatStatus(seat, todayIso()) : null;
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
      <Td className="whitespace-nowrap">
        {seat && seatState ? (
          <>
            <Badge tone={seat.role === "certified" ? "info" : "default"}>
              {reportSeatLabel(seat.role)}
            </Badge>
            {seatState.label !== "فعّال" ? (
              <Badge
                tone={seatState.tone}
                className="ms-1"
                title={seatState.blockReason ?? undefined}
              >
                {seatState.label}
              </Badge>
            ) : null}
          </>
        ) : (
          <span className="text-text-3">—</span>
        )}
      </Td>
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
        <PageLoadingHint />
      ) : (
        <Table className="tabular-nums">
          <THead>
            <Tr hoverable={false}>
              <Th>الاسم</Th>
              <Th>الدور</Th>
              <Th>الصفة في التقرير</Th>
              <Th>القسم</Th>
              <Th>آخر دخول</Th>
              <Th>الحالة</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {filteredUsers.length === 0 ? (
              <TableEmptyRow colSpan={7}>{emptyUsersMessage(users.length)}</TableEmptyRow>
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
