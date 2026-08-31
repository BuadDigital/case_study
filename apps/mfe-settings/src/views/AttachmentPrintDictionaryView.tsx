"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getOrganizationSettings,
  getValuationLists,
  saveOrganizationSettings,
  saveValuationLists,
  VALUER_MEMBERSHIP_CATEGORIES,
  CERTIFIED_VALUER_HTML_DEFAULTS,
  CERTIFIED_VALUER_HTML_BRANCH,
  type OrganizationSettingsDto,
  type OrganizationValuerRosterEntry,
  type ValuationListItemDto,
  type ValuationListsDto,
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
  PageShell,
  Select,
  Spinner,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  useToast,
} from "@platform/ui-kit";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";

const TABS: { id: string; label: string; kind: "table" | "ivs" | "photos" | "cert" | "parts" }[] = [
  { id: "purposes", label: "أغراض التقييم", kind: "table" },
  { id: "valueBases", label: "أساس القيمة", kind: "table" },
  { id: "premises", label: "فرضية القيمة", kind: "table" },
  { id: "methods", label: "أساليب وطرق التقييم", kind: "table" },
  { id: "comparables", label: "العقارات المقارنة", kind: "table" },
  { id: "facades", label: "أنواع الواجهات", kind: "table" },
  { id: "glossary", label: "المصطلحات المهنية", kind: "table" },
  { id: "ivsStandards", label: "معايير التقييم الدولية", kind: "table" },
  { id: "attachments", label: "مرفقات التقرير", kind: "table" },
  { id: "certValuer", label: "بيانات المقيم المعتمد", kind: "cert" },
  { id: "participants", label: "المشاركون في إعداد التقرير", kind: "parts" },
  { id: "photos", label: "صفحات الصور", kind: "photos" },
  { id: "ivs", label: "تاريخ سريان المعايير", kind: "ivs" },
];

const TABLE_META: Record<
  string,
  { addLabel: string; cols: string[]; note: string }
> = {
  purposes: {
    addLabel: "إضافة غرض",
    cols: ["الغرض", "أساس القيمة المعتاد", "الاستخدام", "الحالة", ""],
    note: "الغرض المختار في المعاملة يُطبع في نطاق العمل، ويقترح أساس القيمة المعتاد له (قابل للتغيير من المقيم).",
  },
  valueBases: {
    addLabel: "إضافة أساس قيمة",
    cols: ["الأساس", "التعريف — يُطبع في التقرير عند اختيار الأساس", "الاستخدام", "الحالة", ""],
    note: "عند اختيار أساس القيمة المناسب للعقار في المعاملة يتبدل التعريف المطبوع في نطاق العمل تلقائيًا إلى تعريف الأساس المختار.",
  },
  premises: {
    addLabel: "إضافة فرضية",
    cols: ["الفرضية", "تُستخدم مع", "الاستخدام", "الحالة", ""],
    note: "فرضية القيمة (الاستخدام المفترض) تُطبع في نطاق العمل بجانب أساس القيمة المختار.",
  },
  methods: {
    addLabel: "إضافة طريقة",
    cols: ["الطريقة", "الأسلوب", "الاستخدام", "الحالة", ""],
    note: "لكل أسلوب تقييم طرقه — يختار المقيم في المعاملة الأسلوب ثم الطريقة، ويُطبع الاختيار في القسم «أسلوب وطريقة التقييم المستخدمة».",
  },
  comparables: {
    addLabel: "إضافة عنوان",
    cols: ["العنوان", "مصدر التعبئة", "الاستخدام", "الحالة", ""],
    note: "العناوين المطلوبة لكل عقار مقارن — تظهر أعمدةً في جدول «العقارات المقارنة» بالتقرير، ويعبئها المقيم لكل مقارن.",
  },
  facades: {
    addLabel: "إضافة نوع واجهة",
    cols: ["نوع الواجهة", "التصنيف", "الاستخدام", "الحالة", ""],
    note: "أنواع الواجهات — تُعرض قائمةَ اختيار في حقل «الواجهة» لدى المعاين في شاشة المعاينة الميدانية. المفعَّل فقط يظهر له، ويُنقل المختار إلى وصف العقار في التقرير.",
  },
  glossary: {
    addLabel: "إضافة مصطلح",
    cols: ["المصطلح", "التعريف — يُطبع في القسم 38 من التقرير", "الاستخدام", "الحالة", ""],
    note: "المفعَّل يُطبع في قسم «مصطلحات مهنية» بالتقرير.",
  },
  ivsStandards: {
    addLabel: "إضافة معيار",
    cols: ["المعيار", "الوصف — يُطبع في القسم «معايير التقييم الدولية العامة»", "الاستخدام", "الحالة", ""],
    note: "المفعَّل يُطبع في التقرير.",
  },
  attachments: {
    addLabel: "إضافة مرفق",
    cols: ["المرفق", "الإلزامية", "نوع العقار", "الاستخدام", "الحالة", ""],
    note: "الربط بنوع العقار منطق ثابت — الإعداد يحدد المرفق لا القاعدة.",
  },
};

const PROPERTY_TYPE_SPLIT_RE = /[,،]/;

function emptyItem(listId: string, sortOrder: number): ValuationListItemDto {
  const cellCount = Math.max(0, (TABLE_META[listId]?.cols.length ?? 4) - 4);
  return {
    id: `${listId}-${Date.now()}`,
    key: `item-${Date.now().toString(36)}`,
    name: "عنصر جديد — أكمل البيانات",
    cells: Array.from({ length: cellCount }, () => "—"),
    isEnabled: true,
    defaultName: "عنصر جديد — أكمل البيانات",
    usage: 0,
    sortOrder,
    isSystemDefault: false,
    isRequired: false,
    propertyTypeKeys: [],
  };
}

function membershipLabel(value: string | null | undefined): string {
  return VALUER_MEMBERSHIP_CATEGORIES.find((x) => x.value === value)?.label ?? value ?? "—";
}

export function ValuationListsView() {
  const { showToast } = useToast();
  const [tab, setTab] = useState("purposes");
  const [catalog, setCatalog] = useState<ValuationListsDto | null>(null);
  const [org, setOrg] = useState<OrganizationSettingsDto | null>(null);
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

  const markDirty = useCallback((next: ValuationListsDto) => {
    setCatalog(next);
    setDirty(true);
  }, []);

  const reload = useCallback(async () => {
    const config = organizationSettingsApiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    setLoading(true);
    const [listsRes, orgRes] = await Promise.all([
      getValuationLists(config),
      getOrganizationSettings(config),
    ]);
    setLoading(false);
    if (!listsRes.ok) {
      setError("تعذّر تحميل قوائم التقييم");
      return;
    }
    setError(null);
    setCatalog(listsRes.data);
    setDirty(false);
    if (orgRes.ok) setOrg(orgRes.data);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const meta = TABS.find((t) => t.id === tab) ?? TABS[0];
  const tableMeta = TABLE_META[tab];
  const rows = catalog?.lists[tab] ?? [];

  function patchList(listId: string, nextRows: ValuationListItemDto[]) {
    if (!catalog) return;
    markDirty({
      ...catalog,
      lists: { ...catalog.lists, [listId]: nextRows },
    });
  }

  function patchRow(id: string, patch: Partial<ValuationListItemDto>) {
    patchList(
      tab,
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  async function persist() {
    const config = organizationSettingsApiConfig();
    if (!config || !catalog) return;
    setSaving(true);
    const res = await saveValuationLists(config, {
      ivsEffectiveDate: catalog.ivsEffectiveDate,
      photoPagesLand: catalog.photoPagesLand,
      photoPagesBuilt: catalog.photoPagesBuilt,
      lists: catalog.lists,
    });
    setSaving(false);
    if (!res.ok) {
      showToast("تعذّر حفظ قوائم التقييم", "error");
      return;
    }
    setCatalog(res.data);
    setDirty(false);
    showToast("تم حفظ قوائم التقييم", "success");
  }

  async function persistOrg(next: OrganizationSettingsDto) {
    const config = organizationSettingsApiConfig();
    if (!config) return;
    setSaving(true);
    const res = await saveOrganizationSettings(config, {
      evaluator: next.evaluator,
      valuers: next.valuers,
      valuationReport: next.valuationReport,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ سجل المقيّمين", "error");
      return;
    }
    setOrg(res.data);
    showToast("تم الحفظ", "success");
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
      {error ? <Note tone="warn" className="mb-3">{error}</Note> : null}

      <div className="flex items-start gap-4">
        <nav className="flex w-[190px] shrink-0 flex-col gap-1.5" aria-label="قوائم التقييم">
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-2.5 text-start font-[inherit] text-[13px]",
                  active
                    ? "border border-gold border-s-[3px] bg-gold-soft font-bold text-gold-d"
                    : "border border-border bg-surface font-medium text-text-2 hover:bg-row-hover",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">
          {meta.kind === "ivs" && catalog ? (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3.5">
              <div className="flex min-w-[16rem] flex-col">
                <Label>تاريخ سريان معايير التقييم الدولية (يدوي)</Label>
                <Input
                  value={catalog.ivsEffectiveDate}
                  onChange={(e) => markDirty({ ...catalog, ivsEffectiveDate: e.target.value })}
                />
              </div>
              <p className="mb-2 text-[11.5px] text-text-3">
                يُحدَّث عند صدور نسخة جديدة من المعايير (كل سنتين تقريبًا) ويُطبع في قسم المعايير من التقرير.
              </p>
            </div>
          ) : null}

          {meta.kind === "photos" && catalog ? (
            <>
              <Note className="mt-0">
                عدد صفحات صور العقار المطلوبة في التقرير — كل صفحة تحتوي 6 صور، وتُطبع في قسم «صور العقار».
              </Note>
              <Card className="mt-3">
                <CardBody className="grid max-w-[560px] gap-3.5 sm:grid-cols-2">
                  <div className="flex flex-col">
                    <Label>تقرير تقييم أرض</Label>
                    <Select
                      value={String(catalog.photoPagesLand)}
                      onChange={(e) =>
                        markDirty({ ...catalog, photoPagesLand: Number(e.target.value) })
                      }
                    >
                      <option value="1">صفحة واحدة</option>
                      <option value="2">صفحتان</option>
                      <option value="3">3 صفحات</option>
                    </Select>
                    <p className="m-0 mt-1 text-[11px] text-text-3">
                      = {catalog.photoPagesLand * 6} صور في التقرير
                    </p>
                  </div>
                  <div className="flex flex-col">
                    <Label>تقرير تقييم مبانٍ</Label>
                    <Select
                      value={String(catalog.photoPagesBuilt)}
                      onChange={(e) =>
                        markDirty({ ...catalog, photoPagesBuilt: Number(e.target.value) })
                      }
                    >
                      <option value="1">صفحة واحدة</option>
                      <option value="2">صفحتان</option>
                      <option value="3">3 صفحات</option>
                      <option value="4">4 صفحات</option>
                    </Select>
                    <p className="m-0 mt-1 text-[11px] text-text-3">
                      = {catalog.photoPagesBuilt * 6} صورة في التقرير
                    </p>
                  </div>
                </CardBody>
              </Card>
            </>
          ) : null}

          {meta.kind === "cert" && org ? (
            <CertValuerPanel org={org} onSave={(next) => void persistOrg(next)} saving={saving} />
          ) : null}

          {meta.kind === "parts" && org ? (
            <ParticipantsPanel org={org} onSave={(next) => void persistOrg(next)} saving={saving} />
          ) : null}

          {meta.kind === "table" && tableMeta ? (
            <>
              <div className="mb-3 flex flex-wrap gap-2.5">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => patchList(tab, [...rows, emptyItem(tab, rows.length + 1)])}
                >
                  {tableMeta.addLabel}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const changed = rows.filter(
                      (r) => r.name !== r.defaultName || !r.isEnabled,
                    ).length;
                    setModal({
                      title: "استعادة الافتراضي",
                      body: changed
                        ? `سيُعاد ${changed} عنصراً إلى قيمته وحالته الافتراضية. الإضافات الجديدة تبقى.`
                        : "لا خروج عن الافتراضي في هذه القائمة.",
                      confirm: "استعادة",
                      onConfirm: () => {
                        patchList(
                          tab,
                          rows.map((r) => ({
                            ...r,
                            name: r.defaultName || r.name,
                            isEnabled: r.isSystemDefault ? true : r.isEnabled,
                          })),
                        );
                        showToast("تمت الاستعادة");
                      },
                    });
                  }}
                >
                  استعادة الافتراضي
                </Button>
              </div>
              <Card>
                <Table>
                    <THead>
                      <Tr>
                        {tableMeta.cols.map((col) => (
                          <Th key={col}>{col}</Th>
                        ))}
                      </Tr>
                    </THead>
                    <TBody>
                      {rows.map((row) => (
                        <Tr key={row.id} className={row.isEnabled ? undefined : "opacity-55"}>
                          <Td className="min-w-[220px]">
                            <div className="flex items-center gap-1.5">
                              <input
                                value={row.name}
                                onChange={(e) => patchRow(row.id, { name: e.target.value })}
                                className="w-full border-0 border-b border-transparent bg-transparent p-0.5 font-[inherit] text-[13px] font-medium text-text outline-none focus:border-gold"
                              />
                              {row.name !== row.defaultName ? (
                                <span
                                  title="خرج عن الافتراضي"
                                  className="size-1.5 shrink-0 rounded-full bg-gold"
                                />
                              ) : null}
                            </div>
                            {row.name !== row.defaultName ? (
                              <div className="text-[10.5px] text-text-3">
                                الافتراضي: {row.defaultName}
                              </div>
                            ) : null}
                          </Td>
                          {tab === "attachments" ? (
                            <>
                              <Td>
                                <Select
                                  className="h-8 min-w-[7rem] text-[12.5px]"
                                  value={row.isRequired ? "yes" : "no"}
                                  onChange={(e) =>
                                    patchRow(row.id, {
                                      isRequired: e.target.value === "yes",
                                      cells: [
                                        e.target.value === "yes" ? "إلزامي" : "اختياري",
                                        row.cells[1] ?? "الكل",
                                      ],
                                    })
                                  }
                                >
                                  <option value="yes">إلزامي</option>
                                  <option value="no">اختياري</option>
                                </Select>
                              </Td>
                              <Td>
                                <Input
                                  className="h-8 min-w-[8rem] text-[12.5px]"
                                  value={row.propertyTypeKeys.join("، ") || row.cells[1] || "الكل"}
                                  onChange={(e) => {
                                    const keys = e.target.value
                                      .split(PROPERTY_TYPE_SPLIT_RE)
                                      .map((s) => s.trim())
                                      .filter((s) => s && s !== "الكل");
                                    patchRow(row.id, {
                                      propertyTypeKeys: keys,
                                      cells: [row.isRequired ? "إلزامي" : "اختياري", keys.length ? keys.join("، ") : "الكل"],
                                    });
                                  }}
                                />
                              </Td>
                            </>
                          ) : (
                            row.cells.map((cell, idx) => (
                              <Td key={`${row.id}-c-${idx}`} className="min-w-[12rem]">
                                <input
                                  value={cell}
                                  onChange={(e) =>
                                    patchRow(row.id, {
                                      cells: row.cells.map((c, i) => (i === idx ? e.target.value : c)),
                                    })
                                  }
                                  className="w-full border-0 border-b border-transparent bg-transparent p-0.5 font-[inherit] text-[13px] text-text outline-none focus:border-gold"
                                />
                              </Td>
                            ))
                          )}
                          <Td>
                            <bdi className="font-mono tabular-nums">{row.usage}</bdi>
                          </Td>
                          <Td>
                            <Badge tone={row.isEnabled ? "success" : "default"}>
                              {row.isEnabled ? "ساري" : "معطّل"}
                            </Badge>
                          </Td>
                          <Td>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const doIt = () =>
                                  patchRow(row.id, { isEnabled: !row.isEnabled });
                                if (row.isEnabled && row.usage > 0) {
                                  setModal({
                                    title: "تعطيل عنصر مستعمَل",
                                    body: `«${row.name}» مستعمَل في ${row.usage} معاملة. المعاملات الجارية تحتفظ به، والجديدة لن تجده.`,
                                    confirm: "تعطيل مع فهم الأثر",
                                    onConfirm: doIt,
                                  });
                                } else {
                                  doIt();
                                }
                              }}
                            >
                              {row.isEnabled ? "تعطيل" : "تفعيل"}
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
              </Card>
              <p className="mx-0.5 mt-2.5 mb-0 text-[11.5px] text-text-3">{tableMeta.note}</p>
            </>
          ) : null}
        </div>
      </div>

      {meta.kind === "table" || meta.kind === "ivs" || meta.kind === "photos" ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5">
          {dirty ? (
            <span className="flex items-center gap-1.5 text-[11.5px] text-amber-text">
              <span className="size-1.5 rounded-full bg-warning" />
              تعديل غير محفوظ
            </span>
          ) : null}
          <Button variant="primary" size="sm" loading={saving} onClick={() => void persist()}>
            حفظ
          </Button>
        </div>
      ) : null}

      {modal ? (
        <ModalOverlay onClick={() => setModal(null)}>
          <ModalCard onClick={(e) => e.stopPropagation()} className="p-0">
            <ModalHeader>
              <ModalTitle>{modal.title}</ModalTitle>
            </ModalHeader>
            <ModalBody className="p-4 text-[13px] leading-8 text-text-2">{modal.body}</ModalBody>
            <ModalFooter className="justify-end gap-2">
              <Button variant="default" size="sm" onClick={() => setModal(null)}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  modal.onConfirm();
                  setModal(null);
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

function filled(value: string | null | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  return v.length > 0 ? v : fallback;
}

function CertValuerPanel({
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

function ParticipantsPanel({
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
      <Card>
        <Table>
            <THead>
              <Tr>
                <Th>الاسم</Th>
                <Th>المسمى الوظيفي</Th>
                <Th>فئة العضوية</Th>
                <Th>رقم العضوية</Th>
                <Th>التوقيع</Th>
                <Th>الحالة</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {rows.map((p) => (
                <Tr key={p.id}>
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
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => patch(p.id, { isActive: !p.isActive })}
                    >
                      {p.isActive ? "تعطيل" : "تفعيل"}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
      </Card>
      <p className="mt-2.5 text-[11.5px] text-text-3">
        لا حذف — التعطيل يحفظ ارتباط السجلات بسجل التدقيق. المقيم المعتمد نفسه يُدار من «بيانات المقيم المعتمد».
      </p>
    </>
  );
}

function Field({
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

export { ValuationListsView as AttachmentPrintDictionaryView };
