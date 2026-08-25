"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BRAND_IDENTITY_DEFAULTS,
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
  Th,
  THead,
  Tr,
  useToast,
  type BadgeTone,
} from "@platform/ui-kit";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";

function filled(value: string | null | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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

function sigOk(row: OrganizationValuerRosterEntry): boolean {
  return Boolean(row.signatureUrl?.trim());
}

function pickImage(onPicked: (dataUrl: string, name: string, kb: number) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/svg+xml";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onPicked(reader.result, file.name, Math.round(file.size / 1024));
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

async function refreshOrgCache() {
  const { clearOrganizationSettingsCache, ensureOrganizationSettingsLoaded } =
    await import("@platform/app-shared/organization/organization-settings-cache");
  clearOrganizationSettingsCache();
  await ensureOrganizationSettingsLoaded();
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
    signatureUrl:
      row.signatureUrl?.trim() ||
      branding.signatureUrl?.trim() ||
      BRAND_IDENTITY_DEFAULTS.signatureUrl,
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
      signatureUrl: v.signatureUrl?.trim() ? v.signatureUrl : null,
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

function rowStatus(v: OrganizationValuerRosterEntry, today: string): {
  label: string;
  tone: BadgeTone;
  blockReason: string | null;
} {
  const expired = isIsoDate(v.membershipExpiresAt) && v.membershipExpiresAt! < today;
  const missingSig = !sigOk(v);
  if (!v.isActive) {
    return { label: "معطّل — يدوي", tone: "default", blockReason: null };
  }
  if (expired) {
    return {
      label: "معطّل — النظام",
      tone: "danger",
      blockReason: "عضوية منتهية — يُمنع الإصدار باسمه",
    };
  }
  if (missingSig) {
    return {
      label: "معطّل — النظام",
      tone: "warning",
      blockReason: "التوقيع غير مرفوع — يُمنع الإصدار باسمه",
    };
  }
  return { label: "فعّال", tone: "success", blockReason: null };
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
    setRows(initialRows(res.data));
    setDirty(false);
    setEditingId(null);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mark = (next: OrganizationValuerRosterEntry[]) => {
    setRows(next);
    setDirty(true);
  };

  const patch = (id: string, patch: Partial<OrganizationValuerRosterEntry>) => {
    mark(
      rows.map((v) => {
        if (v.id !== id) {
          if (patch.role === "certified" && v.role === "certified") {
            return { ...v, role: "valuer" };
          }
          return v;
        }
        return { ...v, ...patch };
      }),
    );
  };

  const visible = useMemo(() => {
    const q = query.trim();
    return rows.filter((v) => !q || v.nameAr.includes(q));
  }, [rows, query]);

  const today = todayIso();
  const certMsg = certBlockMessage(rows, today);

  async function persist() {
    const config = organizationSettingsApiConfig();
    if (!config || !org) return;
    const certified = rows.find((v) => v.role === "certified") ?? rows[0];
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
        BRAND_IDENTITY_DEFAULTS.signatureUrl,
    };
    setSaving(true);
    const res = await saveOrganizationSettings(config, {
      company: nextCompany,
      evaluator: nextEvaluator,
      valuers: rows,
      branding: nextBranding,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ سجل المقيّمين", "error");
      return;
    }
    setOrg(res.data);
    setRows(initialRows(res.data));
    setDirty(false);
    setEditingId(null);
    await refreshOrgCache();
    showToast("تم الحفظ وقُيّد في سجل التدقيق.", "success");
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
            onClick={() => {
              const row = newValuer();
              mark([...rows, row]);
              setEditingId(row.id);
            }}
          >
            إضافة مقيّم
          </Button>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <Table className="tabular-nums">
          <THead>
            <Tr hoverable={false}>
              <Th>الاسم</Th>
              <Th>الدور في النظام</Th>
              <Th>فئة العضوية</Th>
              <Th>رقم العضوية</Th>
              <Th>إصدار الترخيص</Th>
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
                        className="h-[30px] min-w-[11rem] py-0 text-xs"
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
                  <Td>
                    {editing ? (
                      <Select
                        className="h-[30px] py-0 text-xs"
                        value={v.role}
                        disabled={!canEdit}
                        onChange={(e) => patch(v.id, { role: e.target.value })}
                      >
                        {VALUER_SYS_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      roleLabel(v.role)
                    )}
                  </Td>
                  <Td>
                    {editing ? (
                      <Select
                        className="h-[30px] py-0 text-xs"
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
                  <Td>
                    {editing ? (
                      <Input
                        dir="ltr"
                        className="h-[30px] max-w-[8rem] py-0 text-xs"
                        value={v.membershipNumber ?? ""}
                        disabled={!canEdit}
                        onChange={(e) =>
                          patch(v.id, { membershipNumber: e.target.value })
                        }
                      />
                    ) : (
                      <bdi>{v.membershipNumber || "—"}</bdi>
                    )}
                  </Td>
                  <Td>
                    {editing ? (
                      <Input
                        type="date"
                        dir="ltr"
                        className="h-[30px] py-0 text-xs"
                        value={
                          isIsoDate(v.licenseIssuedAt) ? v.licenseIssuedAt! : ""
                        }
                        disabled={!canEdit}
                        onChange={(e) =>
                          patch(v.id, { licenseIssuedAt: e.target.value })
                        }
                      />
                    ) : (
                      <bdi>{v.licenseIssuedAt || "—"}</bdi>
                    )}
                  </Td>
                  <Td>
                    {editing ? (
                      <Input
                        type="date"
                        dir="ltr"
                        className="h-[30px] py-0 text-xs"
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
                    ) : (
                      <bdi>{v.membershipExpiresAt || "—"}</bdi>
                    )}
                  </Td>
                  <Td>
                    {sigOk(v) ? (
                      <Badge tone="success">مرفوع</Badge>
                    ) : canEdit ? (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() =>
                          pickImage((url, name, kb) => {
                            setModal({
                              title: "رفع توقيع المقيّم",
                              body: `توقيع «${v.nameAr}» يُطبع في التقارير الجديدة، والرفع يُقيَّد في سجل التدقيق. الملف: ${name} (${kb}KB).`,
                              confirm: "متابعة الرفع",
                              onConfirm: () => patch(v.id, { signatureUrl: url }),
                            });
                          })
                        }
                      >
                        رفع التوقيع
                      </Button>
                    ) : (
                      <Badge tone="warning">غير مرفوع</Badge>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {canEdit ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditingId(editing ? null : v.id)
                          }
                        >
                          {editing ? "تم" : "تعديل"}
                        </Button>{" "}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const doIt = () =>
                              patch(v.id, { isActive: !v.isActive });
                            if (v.isActive) {
                              setModal({
                                title: "تعطيل مقيّم",
                                body: `«${v.nameAr}» يبقى مرتبطاً بسجلاته في سجل التدقيق. التعطيل يمنع إسناده لأي معاملة جديدة.`,
                                confirm: "تعطيل",
                                onConfirm: doIt,
                              });
                            } else {
                              doIt();
                            }
                          }}
                        >
                          {v.isActive ? "تعطيل" : "تفعيل"}
                        </Button>
                      </>
                    ) : null}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </Card>
      <p className="mx-0.5 mt-2.5 text-[11.5px] text-text-3">
        لا حذف — التعطيل يحفظ ارتباط السجلات بسجل التدقيق. «فئة العضوية» صفة مهنية من الهيئة،
        و«الدور في النظام» صلاحية تمنحها المنشأة.
      </p>

      {canEdit ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
          {dirty ? (
            <span className="flex items-center gap-1.5 text-[11.5px] text-amber-text">
              <span className="size-1.5 rounded-full bg-warning" />
              تعديل غير محفوظ
            </span>
          ) : null}
          <Button variant="primary" loading={saving} onClick={() => void persist()}>
            حفظ
          </Button>
        </div>
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
