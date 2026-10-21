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
  MobileRecordCard,
  MobileRecordList,
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
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
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
    <div className="mb-3 flex flex-wrap gap-2.5 max-lg:grid max-lg:grid-cols-2">
      <Input
        className="h-[34px] max-w-[260px] py-0 text-[12.5px] leading-[34px] max-lg:col-span-2 max-lg:h-11 max-lg:max-w-none max-lg:text-[14px] max-lg:leading-[44px]"
        placeholder="بحث بالاسم…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Select
        className={
          "h-[34px] max-w-[170px] py-0 text-[12.5px] leading-[34px] max-lg:h-11 max-lg:max-w-none max-lg:text-[14px] max-lg:leading-[44px]" +
          (canManage ? "" : " max-lg:col-span-2")
        }
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as StaffStatusFilter)}
      >
        <option value="all">كل الحالات</option>
        <option value="on">نشط</option>
        <option value="off">معطّل</option>
        <option value="seated">يظهر في التقرير</option>
      </Select>
      {canManage ? (
        <Button variant="default" className="max-lg:h-11 max-lg:w-full" onClick={openAdd}>
          إضافة مستخدم
        </Button>
      ) : null}
    </div>
  );
}

/** Report seat badges — shared by the table row and the phone card. */
function SeatBadges({ user, workflow }: { user: StaffUser; workflow: UsersOrganizationWorkflow }) {
  const seat = rosterRowFor(workflow.valuers, user.id);
  const seatState = seat ? seatStatus(seat, todayIso()) : null;
  if (!seat || !seatState) return <span className="text-text-3">—</span>;
  return (
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
  );
}

function StaffUserActions({
  user,
  workflow,
  phone = false,
}: {
  user: StaffUser;
  workflow: UsersOrganizationWorkflow;
  /** Phone card: full-width 44px buttons instead of the table's small ghost ones. */
  phone?: boolean;
}) {
  const { canManage, isRowBusy, setEditingUser, onToggleUser } = workflow;
  if (!canManage) return null;
  const busy = isRowBusy(user);
  const variant = phone ? "default" : "ghost";
  const size = phone ? "lg" : "sm";
  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setEditingUser(user)}
        onMouseEnter={preloadEditStaffUserModal}
        onFocus={preloadEditStaffUserModal}
      >
        تعديل
      </Button>
      {phone ? null : " "}
      <Button
        variant={variant}
        size={size}
        loading={busy}
        disabled={busy}
        onClick={() => onToggleUser(user)}
      >
        {userToggleLabel(user.status)}
      </Button>
    </>
  );
}

/** Phones: one record card per user — the 7-column table clipped status and actions. */
function StaffUserCard({
  user,
  workflow,
}: {
  user: StaffUser;
  workflow: UsersOrganizationWorkflow;
}) {
  const seated = Boolean(rosterRowFor(workflow.valuers, user.id));
  return (
    <MobileRecordCard
      title={user.name}
      onOpen={() => workflow.setProfileUser(user)}
      status={<Badge tone={statusTone(user.status)}>{statusLabel(user.status)}</Badge>}
      fields={[
        { label: "الدور", value: user.role || "—" },
        { label: "القسم", value: deptLabel(user) },
        { label: "آخر دخول", ltr: true, value: formatLastLogin(user.lastLoginAtUtc) },
        ...(user.referenceNumber
          ? [{ label: "الرقم المرجعي", ltr: true, value: user.referenceNumber }]
          : []),
        ...(seated
          ? [
              {
                label: "الصفة في التقرير",
                wide: true,
                value: (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <SeatBadges user={user} workflow={workflow} />
                  </span>
                ),
              },
            ]
          : []),
      ]}
      actions={
        workflow.canManage ? (
          <StaffUserActions user={user} workflow={workflow} phone />
        ) : undefined
      }
    />
  );
}

function StaffUserRow({
  user,
  workflow,
}: {
  user: StaffUser;
  workflow: UsersOrganizationWorkflow;
}) {
  const { setProfileUser } = workflow;
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
        <SeatBadges user={user} workflow={workflow} />
      </Td>
      <Td>{deptLabel(user)}</Td>
      <TdLtr bare>{formatLastLogin(user.lastLoginAtUtc)}</TdLtr>
      <Td>
        <Badge tone={statusTone(user.status)}>{statusLabel(user.status)}</Badge>
      </Td>
      <Td className="whitespace-nowrap">
        <StaffUserActions user={user} workflow={workflow} />
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
  const isDesktopViewport = useViewportDesktop();
  return (
    <>
      {isPending && users.length === 0 ? (
        <Card className="overflow-hidden">
          <PageLoadingHint />
        </Card>
      ) : (
        <>
          {isDesktopViewport === true ? null : (
            <MobileRecordList
              className="lg:hidden"
              isEmpty={filteredUsers.length === 0}
              empty={emptyUsersMessage(users.length)}
            >
              {filteredUsers.map((user) => (
                <StaffUserCard key={user.id} user={user} workflow={workflow} />
              ))}
            </MobileRecordList>
          )}
          {isDesktopViewport === false ? null : (
        <Card className="overflow-hidden max-lg:hidden">
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
        </Card>
          )}
        </>
      )}
    </>
  );
}
