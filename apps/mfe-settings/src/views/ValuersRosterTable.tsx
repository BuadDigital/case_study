"use client";

/**
 * Valuers roster table — one `ValuerRow` per visible entry, switching each
 * cell between read-only text and an inline editor when the row is being
 * edited.
 */

import {
  VALUER_ROSTER_MEMBERSHIP_OPTIONS,
  type OrganizationValuerRosterEntry,
} from "@platform/api-client";
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  Table,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
} from "@platform/ui-kit";
import {
  catLabel,
  isIsoDate,
  removeButtonLabel,
  roleLabel,
  roleOptionsFor,
  roleSelectTitle,
  rowStatus,
  sigOk,
} from "./valuers-roster-state";
import type { ValuersRosterWorkflow } from "./useValuersRosterWorkflow";

const EDIT_INPUT_CLS = "!h-9 !py-0 !leading-9 text-[12.5px]";
const EDIT_SELECT_STYLE = {
  height: 36,
  paddingTop: 0,
  paddingBottom: 0,
  lineHeight: "36px",
} as const;

function ValuerRow({
  v,
  workflow,
}: {
  v: OrganizationValuerRosterEntry;
  workflow: ValuersRosterWorkflow;
}) {
  const {
    canEdit,
    saving,
    today,
    editingId,
    certifiedHolderId,
    patch,
    isNewRow,
    toggleEdit,
    confirmToggleActive,
    confirmDiscardOrRemove,
    uploadSignature,
  } = workflow;
  const editing = editingId === v.id;
  const status = rowStatus(v, today);
  const isCert = v.role === "certified";
  const hasSig = sigOk(v);
  const removeLabel = removeButtonLabel(isNewRow(v.id), editing);

  return (
    <Tr hoverable={false}>
      <Td className="min-w-[12rem] align-top">
        {editing ? (
          <Input
            className={`min-w-[11rem] ${EDIT_INPUT_CLS}`}
            value={v.nameAr}
            disabled={!canEdit}
            onChange={(e) => patch(v.id, { nameAr: e.target.value })}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 font-medium">
              <span>{v.nameAr}</span>
              {isCert ? (
                <Badge tone="primary" className="px-2 py-0.5 text-[10.5px]">
                  المقيّم المعتمد
                </Badge>
              ) : null}
            </div>
            {status.blockReason ? (
              <div className="mt-0.5 text-[11px] text-danger-text">
                {status.blockReason}
              </div>
            ) : null}
          </>
        )}
      </Td>
      <Td className="min-w-[11rem] align-middle whitespace-nowrap">
        {editing ? (
          <Select
            className="min-w-[11rem] text-[12.5px]"
            style={EDIT_SELECT_STYLE}
            value={v.role}
            disabled={!canEdit || isCert}
            title={roleSelectTitle(isCert, certifiedHolderId)}
            onChange={(e) => patch(v.id, { role: e.target.value })}
          >
            {roleOptionsFor(isCert, certifiedHolderId).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        ) : (
          roleLabel(v.role)
        )}
      </Td>
      <Td className="min-w-[12rem] align-middle whitespace-nowrap">
        {editing ? (
          <Select
            className="min-w-[12rem] text-[12.5px]"
            style={EDIT_SELECT_STYLE}
            value={v.membershipCategory ?? ""}
            disabled={!canEdit}
            onChange={(e) => patch(v.id, { membershipCategory: e.target.value })}
          >
            <option value="">—</option>
            {VALUER_ROSTER_MEMBERSHIP_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        ) : (
          catLabel(v.membershipCategory)
        )}
      </Td>
      {editing ? (
        <Td>
          <Input
            dir="ltr"
            className={`max-w-[8rem] ${EDIT_INPUT_CLS}`}
            value={v.membershipNumber ?? ""}
            disabled={!canEdit}
            onChange={(e) => patch(v.id, { membershipNumber: e.target.value })}
          />
        </Td>
      ) : (
        <TdLtr bare>{v.membershipNumber || "—"}</TdLtr>
      )}
      {editing ? (
        <Td>
          <Input
            type="date"
            dir="ltr"
            className={EDIT_INPUT_CLS}
            value={isIsoDate(v.membershipExpiresAt) ? v.membershipExpiresAt! : ""}
            disabled={!canEdit}
            onChange={(e) => patch(v.id, { membershipExpiresAt: e.target.value })}
          />
        </Td>
      ) : (
        <TdLtr bare>{v.membershipExpiresAt || "—"}</TdLtr>
      )}
      <Td>
        <div className="flex flex-col items-start gap-1.5">
          {hasSig ? (
            <img
              src={v.signatureUrl!}
              alt={`توقيع ${v.nameAr}`}
              className="h-9 max-w-[7rem] object-contain object-right"
            />
          ) : null}
          {hasSig && !editing ? <Badge tone="success">مرفوع</Badge> : null}
          {canEdit && (editing || !hasSig) ? (
            <Button variant="default" size="sm" onClick={() => uploadSignature(v)}>
              {hasSig ? "استبدال التوقيع" : "رفع التوقيع"}
            </Button>
          ) : null}
        </div>
      </Td>
      <Td>
        <Badge tone={status.tone}>{status.label}</Badge>
      </Td>
      <Td className="whitespace-nowrap">
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => toggleEdit(v.id)}
            >
              {editing ? "تم" : "تعديل"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => confirmToggleActive(v)}
            >
              {v.isActive ? "تعطيل" : "تفعيل"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              className="min-w-[1.75rem] px-1.5 text-danger-text"
              title={removeLabel}
              aria-label={removeLabel}
              onClick={() => confirmDiscardOrRemove(v.id)}
            >
              ×
            </Button>
          </div>
        ) : null}
      </Td>
    </Tr>
  );
}

export function ValuersRosterTable({ workflow }: { workflow: ValuersRosterWorkflow }) {
  return (
    <Card className="overflow-hidden">
      <Table className="min-w-[56rem] tabular-nums">
        <THead>
          <Tr hoverable={false}>
            <Th>الاسم</Th>
            <Th>الدور في النظام</Th>
            <Th>فئة العضوية</Th>
            <Th>رقم العضوية</Th>
            <Th>سريان العضوية</Th>
            <Th>التوقيع</Th>
            <Th>الحالة</Th>
            <Th />
          </Tr>
        </THead>
        <TBody>
          {workflow.visible.map((v) => (
            <ValuerRow key={v.id} v={v} workflow={workflow} />
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
