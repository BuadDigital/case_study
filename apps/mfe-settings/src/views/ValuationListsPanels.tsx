"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  VALUER_MEMBERSHIP_CATEGORIES,
  CERTIFIED_VALUER_HTML_DEFAULTS,
  CERTIFIED_VALUER_HTML_BRANCH,
  type OrganizationSettingsDto,
  type OrganizationValuerRosterEntry,
} from "@platform/api-client";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  ModalBody,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Note,
  Select,
  Table,
  TableEmptyRow,
  TableFrame,
  TBody,
  Td,
  TdAction,
  Th,
  ThAction,
  THead,
  Tr,
  cn,
} from "@platform/ui-kit";

import {
  PROPERTY_TYPE_SPLIT_RE,
  TABLE_META,
  listDataColumnLabels,
  membershipLabel,
  valuationListMiddleCount,
  type AddItemDraft,
} from "../lib/valuation-lists-view-state";

/**
 * Presentational pieces of the valuation lists screen — the RTL column group,
 * the certified valuer panel and its roster, and the add-item modal.
 */

/** Page-level overrides on top of ui-kit Table — keeps columns aligned in RTL. */
export function ValuationListColGroup({ tab }: { tab: string }) {
  const middle = valuationListMiddleCount(tab);
  const middleWidth = middle > 0 ? `${Math.max(14, Math.floor(46 / middle))}%` : undefined;
  return (
    <colgroup>
      <col style={{ width: "36%" }} />
      {Array.from({ length: middle }).map((_, idx) => (
        <col key={`${tab}-mid-${idx}`} style={{ width: middleWidth }} />
      ))}
      <col style={{ width: "5.5rem" }} />
      <col style={{ width: "4.75rem" }} />
    </colgroup>
  );
}

export function filled(value: string | null | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : fallback;
}

export function CertValuerPanel({
  org,
  onSave,
  saving,
}: {
  org: OrganizationSettingsDto;
  onSave: (next: OrganizationSettingsDto) => void;
  saving: boolean;
}) {
  const html = CERTIFIED_VALUER_HTML_DEFAULTS;
  const name = filled(org.evaluator.name, html.name ?? "");
  const licenseNumber = filled(org.evaluator.licenseNumber, html.licenseNumber ?? "");
  const licenseIssuedAt = filled(org.evaluator.licenseIssuedAt, html.licenseIssuedAt ?? "");
  const licenseExpiresHijri = filled(
    org.evaluator.licenseExpiresHijri,
    html.licenseExpiresHijri ?? "",
  );
  const membershipNumber = filled(
    org.evaluator.membershipNumber,
    html.membershipNumber ?? "",
  );
  const membershipCategory = filled(
    org.evaluator.membershipCategory,
    html.membershipCategory ?? "",
  );
  const title = filled(org.evaluator.title, html.title ?? "");
  const membershipExpiresAt = filled(
    org.evaluator.membershipExpiresAt,
    html.membershipExpiresAt ?? "",
  );
  const branch = filled(
    org.valuationReport.valuationBranch,
    CERTIFIED_VALUER_HTML_BRANCH,
  );

  const options = useMemo(() => {
    const names = new Set<string>();
    const out: { id: string; label: string }[] = [];
    const htmlName = html.name ?? "";
    if (htmlName) {
      names.add(htmlName);
      out.push({ id: "html-default", label: htmlName });
    }
    if (org.evaluator.name && !names.has(org.evaluator.name)) {
      names.add(org.evaluator.name);
      out.push({ id: "evaluator", label: org.evaluator.name });
    }
    for (const v of org.valuers) {
      if (names.has(v.nameAr)) continue;
      out.push({ id: v.id, label: v.nameAr });
    }
    return out;
  }, [org, html.name]);

  const selectedId =
    org.valuers.find((v) => v.nameAr === name)?.id
    ?? (org.evaluator.name && org.evaluator.name !== html.name ? "evaluator" : "html-default");

  function selectValuer(id: string) {
    if (id === "html-default") {
      onSave({
        ...org,
        evaluator: { ...org.evaluator, ...html },
        valuationReport: {
          ...org.valuationReport,
          valuationBranch: filled(
            org.valuationReport.valuationBranch,
            CERTIFIED_VALUER_HTML_BRANCH,
          ),
        },
      });
      return;
    }
    if (id === "evaluator") return;
    const v = org.valuers.find((x) => x.id === id);
    if (!v) return;
    onSave({
      ...org,
      evaluator: {
        ...org.evaluator,
        name: v.nameAr,
        licenseNumber: v.licenseNumber ?? org.evaluator.licenseNumber,
        membershipNumber: v.membershipNumber ?? org.evaluator.membershipNumber,
        membershipCategory: v.membershipCategory ?? org.evaluator.membershipCategory,
        licenseExpiresAt: v.licenseExpiresAt ?? org.evaluator.licenseExpiresAt,
        membershipExpiresAt: v.membershipExpiresAt ?? org.evaluator.membershipExpiresAt,
      },
    });
  }

  const sigOk = Boolean(org.branding.signatureUrl);
  const memExp = membershipExpiresAt;
  const expired = Boolean(memExp && memExp < new Date().toISOString().slice(0, 10));
  const blocked = expired
    ? "عضوية منتهية — يُمنع الإصدار باسمه"
    : !sigOk
      ? "التوقيع غير مرفوع — يُمنع الإصدار باسمه"
      : null;

  return (
    <>
      {blocked ? <Note tone="danger">{blocked}</Note> : null}
      <Note className="mt-3">
        مرجع لا نسخة — يُختار المقيم المعتمد من سجل «المقيّمون»، وبياناته وتوقيعه تُحرَّر هناك وحدها.
        تُطبع في القسم 01 وقسم الاعتماد 27.
      </Note>
      <Card className="mt-3">
        <CardHeader>
          <h2 className="m-0 text-sm font-bold">المقيم المعتمد</h2>
          <Link
            href="/organization-settings?tab=evaluator"
            className="text-[12.5px] font-semibold text-primary"
          >
            التعديل في «المقيّمون»
          </Link>
        </CardHeader>
        <CardBody className="grid gap-3.5 sm:grid-cols-2">
          <div className="flex max-w-[32rem] flex-col sm:col-span-2">
            <Label>اختيار المقيم المعتمد (من سجل المقيّمين)</Label>
            <Select
              value={selectedId}
              disabled={saving || options.length === 0}
              onChange={(e) => selectValuer(e.target.value)}
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <Field label="رقم ترخيص مزاولة المهنة" value={licenseNumber} ltr />
          <Field label="فرع التقييم" value={branch} />
          <Field label="تاريخ إصدار الترخيص (هجري)" value={licenseIssuedAt} ltr />
          <Field label="تاريخ انتهاء الترخيص (هجري)" value={licenseExpiresHijri} ltr />
          <Field label="رقم العضوية" value={membershipNumber} ltr />
          <Field label="فئة العضوية" value={membershipLabel(membershipCategory)} />
          <Field label="صفته" value={title} />
          <Field label="تاريخ انتهاء العضوية" value={membershipExpiresAt} ltr />
          <div className="flex flex-wrap items-center gap-2.5 sm:col-span-2">
            <span className="text-[12px] font-semibold text-text-2">التوقيع:</span>
            {sigOk ? (
              <Badge tone="success">مرفوع</Badge>
            ) : (
              <Badge tone="warning">غير مرفوع — يمنع الإصدار</Badge>
            )}
            <span className="text-[11.5px] text-text-3">
              يُرفع من سجل «المقيّمون» — أما ختم المنشأة فمن «الهوية البصرية».
            </span>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

export function ParticipantsPanel({
  org,
  onSave,
  saving,
}: {
  org: OrganizationSettingsDto;
  onSave: (next: OrganizationSettingsDto) => void;
  saving: boolean;
}) {
  const [rows, setRows] = useState(org.valuers);
  useEffect(() => {
    setRows(org.valuers);
  }, [org.valuers]);

  function patch(id: string, patch: Partial<OrganizationValuerRosterEntry>) {
    setRows((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  function add() {
    setRows((prev) => [
      ...prev,
      {
        id: `v-${Date.now()}`,
        nameAr: "مشارك جديد",
        role: "assistant",
        isActive: true,
      },
    ]);
  }

  return (
    <>
      <Note className="mt-0">
        تُطبع القائمة في القسم 26 «المشاركون في إعداد التقرير» — التقارير المُصدَرة تجمّد نسختها وقت الإصدار.
      </Note>
      <div className="my-3 flex flex-wrap gap-2">
        <Button variant="default" size="sm" disabled={saving} onClick={add}>
          إضافة مشارك
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={saving}
          onClick={() => onSave({ ...org, valuers: rows })}
        >
          حفظ المشاركين
        </Button>
      </div>
      <TableFrame>
        <Table>
          <THead>
            <Tr hoverable={false}>
              <Th>الاسم</Th>
              <Th>المسمى الوظيفي</Th>
              <Th>فئة العضوية</Th>
              <Th>رقم العضوية</Th>
              <Th>التوقيع</Th>
              <Th>الحالة</Th>
              <ThAction aria-label="إجراءات" />
            </Tr>
          </THead>
          <TBody>
            {rows.map((p) => (
              <Tr key={p.id} hoverable={false}>
                  <Td className="min-w-[180px]">
                    <input
                      value={p.nameAr}
                      onChange={(e) => patch(p.id, { nameAr: e.target.value })}
                      className="w-full border-0 bg-transparent font-[inherit] text-[13px] font-medium outline-none"
                    />
                  </Td>
                  <Td>
                    <Select
                      className="h-8 text-[12.5px]"
                      value={p.role}
                      onChange={(e) => patch(p.id, { role: e.target.value })}
                    >
                      <option value="certified">مقيم عقاري معتمد</option>
                      <option value="reviewer">مقيم عقاري مراجع</option>
                      <option value="assistant">مساعد مقيم</option>
                    </Select>
                  </Td>
                  <Td>
                    <Select
                      className="h-8 text-[12.5px]"
                      value={p.membershipCategory ?? ""}
                      onChange={(e) => patch(p.id, { membershipCategory: e.target.value || null })}
                    >
                      <option value="">—</option>
                      {VALUER_MEMBERSHIP_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <input
                      dir="ltr"
                      value={p.membershipNumber ?? ""}
                      onChange={(e) => patch(p.id, { membershipNumber: e.target.value })}
                      className="w-full border-0 bg-transparent font-mono text-[13px] outline-none"
                    />
                  </Td>
                  <Td>
                    <Badge tone={org.branding.signatureUrl ? "success" : "warning"}>
                      {org.branding.signatureUrl ? "مرفوع" : "غير مرفوع"}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={p.isActive ? "success" : "default"}>
                      {p.isActive ? "ساري" : "معطّل"}
                    </Badge>
                  </Td>
                  <TdAction>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => patch(p.id, { isActive: !p.isActive })}
                    >
                      {p.isActive ? "تعطيل" : "تفعيل"}
                    </Button>
                  </TdAction>
                </Tr>
              ))}
          </TBody>
        </Table>
      </TableFrame>
      <p className="mt-2.5 text-[11.5px] text-text-3">
        لا حذف — التعطيل يحفظ ارتباط السجلات بسجل التدقيق. المقيم المعتمد نفسه يُدار من «بيانات المقيم المعتمد».
      </p>
    </>
  );
}

export function Field({
  label,
  value,
  ltr,
}: {
  label: string;
  value?: string | null;
  ltr?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[12px] font-semibold text-text-2">{label}</span>
      <span className="text-[13px] font-medium" dir={ltr ? "ltr" : undefined}>
        {value || "—"}
      </span>
    </div>
  );
}

export function ListItemAddModal({
  listId,
  title,
  draft,
  saving,
  onDraftChange,
  onClose,
  onSave,
}: {
  listId: string;
  title: string;
  draft: AddItemDraft;
  saving: boolean;
  onDraftChange: (next: AddItemDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const meta = TABLE_META[listId];
  const nameLabel = meta?.cols[0] ?? "الاسم";
  const extraLabels =
    listId === "attachments" || listId === "boundaryTypes"
      ? []
      : listDataColumnLabels(listId).slice(1, -1);
  const valid = draft.name.trim().length > 0;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard onClick={(e) => e.stopPropagation()} role="dialog" aria-modal className="p-0">
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-3.5 p-4">
          <div>
            <Label htmlFor="list-add-name">{nameLabel}</Label>
            <Input
              id="list-add-name"
              value={draft.name}
              autoFocus
              placeholder={`أدخل ${nameLabel}`}
              onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
            />
          </div>
          {listId === "attachments" ? (
            <>
              <div>
                <Label htmlFor="list-add-required">الإلزامية</Label>
                <Select
                  id="list-add-required"
                  value={draft.isRequired ? "yes" : "no"}
                  onChange={(e) =>
                    onDraftChange({ ...draft, isRequired: e.target.value === "yes" })
                  }
                >
                  <option value="yes">إلزامي</option>
                  <option value="no">اختياري</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="list-add-property-types">نوع العقار</Label>
                <Input
                  id="list-add-property-types"
                  value={draft.propertyTypeKeys.join("، ")}
                  placeholder="الكل — أو مثال: أرض، مبانٍ"
                  onChange={(e) => {
                    const keys = e.target.value
                      .split(PROPERTY_TYPE_SPLIT_RE)
                      .map((s) => s.trim())
                      .filter((s) => s && s !== "الكل");
                    onDraftChange({ ...draft, propertyTypeKeys: keys });
                  }}
                />
              </div>
            </>
          ) : (
            extraLabels.map((label, idx) => (
              <div key={`${listId}-field-${idx}`}>
                <Label htmlFor={`list-add-cell-${idx}`}>{label}</Label>
                {label.length > 40 ? (
                  <textarea
                    id={`list-add-cell-${idx}`}
                    value={draft.cells[idx] ?? ""}
                    rows={3}
                    className={cn(
                      "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 font-[inherit] text-[13px] text-text outline-none focus:border-gold",
                    )}
                    placeholder={`أدخل ${label}`}
                    onChange={(e) => {
                      const cells = [...draft.cells];
                      cells[idx] = e.target.value;
                      onDraftChange({ ...draft, cells });
                    }}
                  />
                ) : (
                  <Input
                    id={`list-add-cell-${idx}`}
                    value={draft.cells[idx] ?? ""}
                    placeholder={`أدخل ${label}`}
                    onChange={(e) => {
                      const cells = [...draft.cells];
                      cells[idx] = e.target.value;
                      onDraftChange({ ...draft, cells });
                    }}
                  />
                )}
              </div>
            ))
          )}
        </ModalBody>
        <ModalFooter className="justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={saving}
            disabled={!valid || saving}
            onClick={onSave}
          >
            حفظ
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
