"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CERTIFIED_VALUER_HTML_DEFAULTS,
  VALUER_ROSTER_HTML_DEFAULTS,
  VALUER_ROSTER_MEMBERSHIP_OPTIONS,
  VALUER_SYS_ROLES,
  getOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationBrandingSettings,
  type OrganizationCompanySettings,
  type OrganizationEvaluatorSettings,
  type OrganizationSettingsDto,
  type OrganizationValuerRosterEntry,
} from "@platform/api-client";
import { useCapability } from "@platform/app-shared/components/Can";
import {
  Badge,
  Button,
  Card,
  Input,
  ModalBody,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Note,
  PageShell,
  Select,
  Spinner,
  Table,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
  useToast,
  type BadgeTone,
} from "@platform/ui-kit";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";
import { pickImage, refreshOrgCache } from "../lib/org-settings-ui";
import { todayIso } from "@platform/app-shared/format/date";

function filled(value: string | null | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}


const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: string | null | undefined): boolean {
  return Boolean(value && ISO_DATE_RE.test(value));
}

function roleLabel(role: string): string {
  return VALUER_SYS_ROLES.find((r) => r.value === role)?.label ?? role;
}

function catLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return (
    VALUER_ROSTER_MEMBERSHIP_OPTIONS.find((c) => c.value === value)?.label ??
    value
  );
}

/** Stock prototype asset — not a real uploaded signature. */
function isStockSignatureUrl(url: string | null | undefined): boolean {
  const u = (url ?? "").trim();
  return !u || u.endsWith("ejadah-signature.png");
}

function sigOk(row: OrganizationValuerRosterEntry): boolean {
  const u = row.signatureUrl?.trim();
  return Boolean(u) && !isStockSignatureUrl(u);
}



function overlayCertified(
  row: OrganizationValuerRosterEntry,
  evaluator: OrganizationEvaluatorSettings,
  branding: OrganizationBrandingSettings,
): OrganizationValuerRosterEntry {
  const html = CERTIFIED_VALUER_HTML_DEFAULTS;
  return {
    ...row,
    nameAr: filled(evaluator.name, filled(row.nameAr, html.name ?? "")),
    licenseNumber: filled(
      evaluator.licenseNumber,
      filled(row.licenseNumber, html.licenseNumber ?? ""),
    ),
    membershipNumber: filled(
      evaluator.membershipNumber,
      filled(row.membershipNumber, html.membershipNumber ?? ""),
    ),
    membershipCategory: filled(
      evaluator.membershipCategory,
      filled(row.membershipCategory, html.membershipCategory ?? ""),
    ),
    membershipExpiresAt: filled(
      evaluator.membershipExpiresAt,
      filled(row.membershipExpiresAt, html.membershipExpiresAt ?? ""),
    ),
    signatureUrl: (() => {
      const own = row.signatureUrl?.trim() ?? "";
      if (own && !own.endsWith("ejadah-signature.png")) return own;
      const brand = branding.signatureUrl?.trim() ?? "";
      if (brand && !brand.endsWith("ejadah-signature.png")) return brand;
      return null;
    })(),
    role: "certified",
  };
}

function initialRows(org: OrganizationSettingsDto): OrganizationValuerRosterEntry[] {
  const certId = filled(org.company.certifiedValuerId, "");
  const source =
    org.valuers.length > 0
      ? org.valuers
      : VALUER_ROSTER_HTML_DEFAULTS.map((v) => ({ ...v }));
  const named = filled(org.evaluator.name, "");
  let certIndex = source.findIndex(
    (v) => v.role === "certified" || v.id === certId || (named && v.nameAr === named),
  );
  if (certIndex < 0) certIndex = 0;
  return source.map((v, i) => {
    if (i === certIndex) return overlayCertified(v, org.evaluator, org.branding);
    return {
      ...v,
      role: v.role === "certified" ? "valuer" : v.role,
      signatureUrl: (() => {
        const u = v.signatureUrl?.trim() ?? "";
        if (!u || u.endsWith("ejadah-signature.png")) return null;
        return v.signatureUrl;
      })(),
    };
  });
}

function newValuer(): OrganizationValuerRosterEntry {
  return {
    id: `v${Date.now()}`,
    nameAr: "مقيّم جديد — أكمل البيانات",
    role: "assistant",
    membershipCategory: "",
    membershipNumber: "",
    membershipExpiresAt: "",
    isActive: true,
    signatureUrl: null,
  };
}

function completenessGaps(
  v: OrganizationValuerRosterEntry,
  today: string,
): string[] {
  const gaps: string[] = [];
  const name = v.nameAr.trim();
  if (!name || name.includes("أكمل البيانات")) gaps.push("الاسم");
  if (!v.role?.trim()) gaps.push("الدور");
  if (!v.membershipCategory?.trim()) gaps.push("فئة العضوية");
  if (!v.membershipNumber?.trim()) gaps.push("رقم العضوية");
  if (!isIsoDate(v.membershipExpiresAt)) gaps.push("سريان العضوية");
  else if (v.membershipExpiresAt! < today) gaps.push("عضوية منتهية");
  if (!sigOk(v)) gaps.push("التوقيع");
  return gaps;
}

function isRowComplete(v: OrganizationValuerRosterEntry, today: string): boolean {
  return completenessGaps(v, today).length === 0;
}

function rowStatus(v: OrganizationValuerRosterEntry, today: string): {
  label: string;
  tone: BadgeTone;
  blockReason: string | null;
} {
  if (!v.isActive) {
    return { label: "معطّل — يدوي", tone: "default", blockReason: null };
  }
  const gaps = completenessGaps(v, today);
  if (gaps.length > 0) {
    return {
      label: "غير مكتمل",
      tone: gaps.includes("عضوية منتهية") ? "danger" : "warning",
      blockReason: `أكمل: ${gaps.join(" · ")} — يُمنع الإصدار باسمه`,
    };
  }
  return { label: "فعّال", tone: "success", blockReason: null };
}

/** All row fields are scalar values — no need to serialize the whole record on every keystroke. */
const ROSTER_COMPARED_FIELDS = [
  "id",
  "nameAr",
  "licenseNumber",
  "membershipNumber",
  "membershipCategory",
  "licenseExpiresAt",
  "licenseIssuedAt",
  "membershipExpiresAt",
  "role",
  "isActive",
  "signatureUrl",
] as const satisfies readonly (keyof OrganizationValuerRosterEntry)[];

function rostersEqual(
  a: OrganizationValuerRosterEntry[],
  b: OrganizationValuerRosterEntry[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]!;
    const right = b[i]!;
    for (const field of ROSTER_COMPARED_FIELDS) {
      if (left[field] !== right[field]) return false;
    }
  }
  return true;
}

function certBlockMessage(rows: OrganizationValuerRosterEntry[], today: string): string {
  const c = rows.find((v) => v.role === "certified");
  if (!c) return "لم يُحدَّد مقيّم معتمد — يُمنع إصدار أي تقرير.";
  const reasons: string[] = [];
  if (!c.isActive) reasons.push("الحساب معطّل");
  if (isIsoDate(c.membershipExpiresAt) && c.membershipExpiresAt! < today) {
    reasons.push("العضوية منتهية");
  }
  if (!sigOk(c)) reasons.push("التوقيع غير مرفوع");
  return reasons.length
    ? `يُمنع إصدار أي تقرير — بيانات المقيّم المعتمد («${c.nameAr}») غير صالحة: ${reasons.join(" · ")}.`
    : "";
}

export function ValuersRosterView() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
  const [rows, setRows] = useState<OrganizationValuerRosterEntry[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [baseline, setBaseline] = useState<OrganizationValuerRosterEntry[]>([]);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    title: string;
    body: string;
    confirm: string;
    onConfirm: () => void;
  } | null>(null);

  const applyRows = (next: OrganizationValuerRosterEntry[], nextBaseline?: OrganizationValuerRosterEntry[]) => {
    const base = nextBaseline ?? baseline;
    setRows(next);
    if (nextBaseline) setBaseline(nextBaseline);
    setDirty(!rostersEqual(next, base));
  };

  const reload = useCallback(async () => {
    const config = organizationSettingsApiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    setLoading(true);
    const res = await getOrganizationSettings(config);
    setLoading(false);
    if (!res.ok) {
      setError("تعذّر تحميل سجل المقيّمين");
      return;
    }
    setError(null);
    setOrg(res.data);
    const next = initialRows(res.data);
    setRows(next);
    setBaseline(next.map((r) => ({ ...r })));
    setDirty(false);
    setEditingId(null);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mark = (next: OrganizationValuerRosterEntry[]) => {
    applyRows(next);
  };

  const certifiedHolderId = useMemo(
    () => rows.find((v) => v.role === "certified")?.id ?? null,
    [rows],
  );

  const patch = (id: string, next: Partial<OrganizationValuerRosterEntry>) => {
    if (next.role === "certified") {
      const holder = rows.find((v) => v.role === "certified");
      if (holder && holder.id !== id) {
        showToast(
          `دور «مقيم معتمد» محجوز لـ «${holder.nameAr}» — لا يمكن إسناده لغيره.`,
          "error",
        );
        return;
      }
    }
    if (
      next.role != null &&
      next.role !== "certified" &&
      rows.find((v) => v.id === id)?.role === "certified"
    ) {
      showToast(
        "لا يمكن سحب دور «مقيم معتمد» بعد إسناده — عطّل الحساب إن لزم دون تغيير الدور.",
        "error",
      );
      return;
    }
    mark(rows.map((v) => (v.id === id ? { ...v, ...next } : v)));
  };

  const discardOrRemove = (id: string): OrganizationValuerRosterEntry[] => {
    const saved = baseline.find((b) => b.id === id);
    if (!saved) {
      const next = rows.filter((r) => r.id !== id);
      mark(next);
      if (editingId === id) setEditingId(null);
      return next;
    }
    const next = rows.map((r) => (r.id === id ? { ...saved } : r));
    mark(next);
    if (editingId === id) setEditingId(null);
    return next;
  };

  const confirmDiscardOrRemove = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const isNew = !baseline.some((b) => b.id === id);
    const isEditing = editingId === id;

    if (!isNew && !isEditing && row.role === "certified") {
      showToast(
        "لا يمكن حذف المقيّم المعتمد — الدور محجوز بعد إسناده. يمكنك تعطيل الحساب فقط.",
        "error",
      );
      return;
    }

    if (isNew) {
      setModal({
        title: "إزالة الصف",
        body: `إزالة «${row.nameAr}» من القائمة؟ سيُحفظ السجل فوراً.`,
        confirm: "إزالة وحفظ",
        onConfirm: () => {
          const next = discardOrRemove(id);
          void persistRows(next);
        },
      });
      return;
    }

    if (isEditing) {
      setModal({
        title: "إلغاء التعديل",
        body: `إلغاء تعديلات «${row.nameAr}» والرجوع للقيم المحفوظة؟`,
        confirm: "إلغاء التعديل",
        onConfirm: () => {
          discardOrRemove(id);
        },
      });
      return;
    }

    setModal({
      title: "حذف مقيّم",
      body: `حذف «${row.nameAr}» من السجل وحفظ التغيير فوراً. لن يظهر في التقارير الجديدة.`,
      confirm: "حذف وحفظ",
      onConfirm: () => {
        const next = rows.filter((r) => r.id !== id);
        if (editingId === id) setEditingId(null);
        void persistRows(next);
      },
    });
  };

  const visible = useMemo(() => {
    const q = query.trim();
    return rows.filter((v) => !q || v.nameAr.includes(q));
  }, [rows, query]);

  const today = todayIso();
  const certMsg = certBlockMessage(rows, today);

  const incompleteActive = useMemo(() => {
    return rows.filter((v) => v.isActive && !isRowComplete(v, today));
  }, [rows, today]);

  const canAddValuer = incompleteActive.length === 0 && editingId == null;

  function tryAddValuer() {
    if (editingId) {
      showToast("أنهِ تعديل الصف الحالي («تم») قبل إضافة مقيّم جديد.", "error");
      return;
    }
    if (incompleteActive.length > 0) {
      const sample = incompleteActive.slice(0, 2).map((v) => {
        const gaps = completenessGaps(v, today);
        return `«${v.nameAr}» (${gaps.join(" · ")})`;
      });
      const more =
        incompleteActive.length > 2
          ? ` و${incompleteActive.length - 2} آخرين`
          : "";
      showToast(
        `أكمل بيانات المقيّمين الحاليين قبل الإضافة: ${sample.join("؛ ")}${more}.`,
        "error",
      );
      return;
    }
    const row = newValuer();
    mark([...rows, row]);
    setEditingId(row.id);
  }

  async function persistRows(
    nextRows: OrganizationValuerRosterEntry[],
    successToast = "تم الحفظ وقُيّد في سجل التدقيق.",
  ) {
    const config = organizationSettingsApiConfig();
    if (!config || !org) return false;
    const certified = nextRows.find((v) => v.role === "certified") ?? nextRows[0];
    const nextEvaluator: OrganizationEvaluatorSettings = {
      ...org.evaluator,
      name: certified?.nameAr ?? org.evaluator.name,
      licenseNumber: certified?.licenseNumber ?? org.evaluator.licenseNumber,
      membershipNumber: certified?.membershipNumber ?? org.evaluator.membershipNumber,
      membershipCategory:
        certified?.membershipCategory ?? org.evaluator.membershipCategory,
      membershipExpiresAt:
        certified?.membershipExpiresAt ?? org.evaluator.membershipExpiresAt,
    };
    const nextCompany: OrganizationCompanySettings = {
      ...org.company,
      certifiedValuerId: certified?.id ?? org.company.certifiedValuerId,
    };
    const nextBranding: OrganizationBrandingSettings = {
      ...org.branding,
      signatureUrl:
        certified?.signatureUrl?.trim() ||
        org.branding.signatureUrl ||
        "",
    };
    setSaving(true);
    const res = await saveOrganizationSettings(config, {
      company: nextCompany,
      evaluator: nextEvaluator,
      valuers: nextRows,
      branding: nextBranding,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ سجل المقيّمين", "error");
      return false;
    }
    setOrg(res.data);
    const next = initialRows(res.data);
    setRows(next);
    setBaseline(next.map((r) => ({ ...r })));
    setDirty(false);
    setEditingId(null);
    await refreshOrgCache();
    showToast(successToast, "success");
    return true;
  }

  function finishEdit(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) {
      setEditingId(null);
      return;
    }
    if (row.isActive && !isRowComplete(row, today)) {
      const gaps = completenessGaps(row, today);
      showToast(`أكمل البيانات قبل «تم»: ${gaps.join(" · ")}.`, "error");
      return;
    }
    void persistRows(rows, "تم الحفظ.");
  }

  function toggleActive(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const nextRows = rows.map((v) =>
      v.id === id ? { ...v, isActive: !v.isActive } : v,
    );
    void persistRows(
      nextRows,
      row.isActive ? "تم التعطيل والحفظ." : "تم التفعيل والحفظ.",
    );
  }

  if (loading) {
    return (
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
        <div className="flex items-center justify-center gap-2 py-20 text-text-3">
          <Spinner />
          <span className="text-[13px]">جاري التحميل…</span>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
      {!canEdit ? (
        <Note tone="warn" className="mb-3 max-w-[560px]">
          الرابط صحيح، لكن دورك الحالي لا يملك صلاحية هذا البند. اطلب الصلاحية من مسؤول النظام.
        </Note>
      ) : null}
      {error ? <Note tone="warn">{error}</Note> : null}
      {certMsg ? (
        <Note tone="danger" className="mt-0">
          {certMsg}
        </Note>
      ) : null}
      <Note className="mt-0">
        هذا هو السجل الأساسي للمقيّمين — «المشاركون في إعداد التقرير» و«بيانات المقيم المعتمد» في
        قوائم التقييم يُختاران من هذه القائمة.
      </Note>

      <div className="mb-3 mt-3 flex flex-wrap gap-2.5">
        <Input
          className="h-[34px] max-w-[260px] py-0 text-[12.5px] leading-[34px]"
          placeholder="بحث بالاسم…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {canEdit ? (
          <Button
            variant="default"
            disabled={!canAddValuer}
            title={
              !canAddValuer
                ? editingId
                  ? "أنهِ تعديل الصف الحالي قبل الإضافة"
                  : "أكمل بيانات كل المقيّمين الفعّالين قبل الإضافة"
                : undefined
            }
            onClick={() => tryAddValuer()}
          >
            إضافة مقيّم
          </Button>
        ) : null}
      </div>

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
            {visible.map((v) => {
              const editing = editingId === v.id;
              const status = rowStatus(v, today);
              const isCert = v.role === "certified";
              return (
                <Tr key={v.id} hoverable={false}>
                  <Td className="min-w-[12rem] align-top">
                    {editing ? (
                      <Input
                        className="min-w-[11rem] !h-9 !py-0 !leading-9 text-[12.5px]"
                        value={v.nameAr}
                        disabled={!canEdit}
                        onChange={(e) => patch(v.id, { nameAr: e.target.value })}
                      />
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2 font-medium">
                          <span>{v.nameAr}</span>
                          {isCert ? (
                            <Badge
                              tone="primary"
                              className="px-2 py-0.5 text-[10.5px]"
                            >
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
                        style={{
                          height: 36,
                          paddingTop: 0,
                          paddingBottom: 0,
                          lineHeight: "36px",
                        }}
                        value={v.role}
                        disabled={!canEdit || isCert}
                        title={
                          isCert
                            ? "دور «مقيم معتمد» محجوز بعد إسناده ولا يمكن تغييره"
                            : certifiedHolderId
                              ? "دور «مقيم معتمد» مسند لمقيّم آخر"
                              : undefined
                        }
                        onChange={(e) => patch(v.id, { role: e.target.value })}
                      >
                        {VALUER_SYS_ROLES.filter((r) => {
                          if (r.value !== "certified") return true;
                          if (isCert) return true;
                          return !certifiedHolderId;
                        }).map((r) => (
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
                        style={{
                          height: 36,
                          paddingTop: 0,
                          paddingBottom: 0,
                          lineHeight: "36px",
                        }}
                        value={v.membershipCategory ?? ""}
                        disabled={!canEdit}
                        onChange={(e) =>
                          patch(v.id, { membershipCategory: e.target.value })
                        }
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
                        className="max-w-[8rem] !h-9 !py-0 !leading-9 text-[12.5px]"
                        value={v.membershipNumber ?? ""}
                        disabled={!canEdit}
                        onChange={(e) =>
                          patch(v.id, { membershipNumber: e.target.value })
                        }
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
                        className="!h-9 !py-0 !leading-9 text-[12.5px]"
                        value={
                          isIsoDate(v.membershipExpiresAt)
                            ? v.membershipExpiresAt!
                            : ""
                        }
                        disabled={!canEdit}
                        onChange={(e) =>
                          patch(v.id, { membershipExpiresAt: e.target.value })
                        }
                      />
                    </Td>
                  ) : (
                    <TdLtr bare>{v.membershipExpiresAt || "—"}</TdLtr>
                  )}
                  <Td>
                    <div className="flex flex-col items-start gap-1.5">
                      {sigOk(v) ? (
                        <img
                          src={v.signatureUrl!}
                          alt={`توقيع ${v.nameAr}`}
                          className="h-9 max-w-[7rem] object-contain object-right"
                        />
                      ) : null}
                      {sigOk(v) && !editing ? (
                        <Badge tone="success">مرفوع</Badge>
                      ) : null}
                      {canEdit && (editing || !sigOk(v)) ? (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() =>
                            pickImage((url, name, kb) => {
                              const valuerId = v.id;
                              setModal({
                                title: sigOk(v)
                                  ? "استبدال توقيع المقيّم"
                                  : "رفع توقيع المقيّم",
                                body: `توقيع «${v.nameAr}» يُطبع في التقارير الجديدة، والرفع يُقيَّد في سجل التدقيق. الملف: ${name} (${kb}KB).`,
                                confirm: "متابعة الرفع",
                                onConfirm: () => {
                                  // Latest rows — avoid an upload race that drops other signatures.
                                  const nextRows = rowsRef.current.map((r) =>
                                    r.id === valuerId
                                      ? { ...r, signatureUrl: url }
                                      : r,
                                  );
                                  void persistRows(nextRows, "تم رفع التوقيع والحفظ.");
                                },
                              });
                            })
                          }
                        >
                          {sigOk(v) ? "استبدال التوقيع" : "رفع التوقيع"}
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
                          onClick={() => {
                            if (editing) finishEdit(v.id);
                            else setEditingId(v.id);
                          }}
                        >
                          {editing ? "تم" : "تعديل"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => {
                            if (v.isActive) {
                              setModal({
                                title: "تعطيل مقيّم",
                                body: `«${v.nameAr}» يبقى مرتبطاً بسجلاته في سجل التدقيق. التعطيل يُحفظ فوراً ويمنع إسناده لأي معاملة جديدة.`,
                                confirm: "تعطيل وحفظ",
                                onConfirm: () => toggleActive(v.id),
                              });
                            } else {
                              toggleActive(v.id);
                            }
                          }}
                        >
                          {v.isActive ? "تعطيل" : "تفعيل"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          className="min-w-[1.75rem] px-1.5 text-danger-text"
                          title={
                            !baseline.some((b) => b.id === v.id)
                              ? "إزالة الصف"
                              : editing
                                ? "إلغاء التعديل"
                                : "حذف"
                          }
                          aria-label={
                            !baseline.some((b) => b.id === v.id)
                              ? "إزالة الصف"
                              : editing
                                ? "إلغاء التعديل"
                                : "حذف"
                          }
                          onClick={() => confirmDiscardOrRemove(v.id)}
                        >
                          ×
                        </Button>
                      </div>
                    ) : null}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </Card>
      <p className="mx-0.5 mt-2.5 text-[11.5px] text-text-3">
        «تم» و«تعطيل» و«×» تحفظ مباشرة بعد التأكيد — لا حاجة لزر حفظ منفصل. أكمل بيانات كل مقيّم
        فعّال قبل إضافة آخر. دور «مقيم معتمد» يُسند مرة ويُحجز.
      </p>

      {saving ? (
        <div className="mt-3 flex items-center justify-end gap-2 text-[12px] text-text-3">
          <Spinner />
          جاري الحفظ…
        </div>
      ) : dirty ? (
        <p className="mt-3 text-end text-[11.5px] text-amber-text">
          تعديلات معلّقة — اضغط «تم» لحفظ الصف.
        </p>
      ) : null}

      {modal ? (
        <ModalOverlay onClick={() => setModal(null)}>
          <ModalCard
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
            aria-labelledby="valuers-modal-title"
          >
            <ModalHeader>
              <ModalTitle id="valuers-modal-title">{modal.title}</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p className="m-0 text-[13px] leading-relaxed text-text-2">{modal.body}</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setModal(null)}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const fn = modal.onConfirm;
                  setModal(null);
                  fn();
                }}
              >
                {modal.confirm}
              </Button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </PageShell>
  );
}
