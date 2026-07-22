"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  FormGroup,
  Input,
  Label,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Note,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  useToast,
} from "@platform/design-system";
import { Can, useCapability } from "@platform/app-shared/components/Can";
import type {
  PartyFeePricingCategory,
  PartyFeePricingDto,
  PartyFeePricingTableSummaryDto,
  PartyFeePricingTierDto,
} from "@platform/api-client";
import {
  getEngineeringOffices,
  getFieldInspectors,
  getGovernmentAuditors,
  type DistributionAssignee,
} from "@case-study/mfe/lib/distribution-assignees";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import {
  activatePartyFeePricingTable,
  createPartyFeePricingTable,
  deletePartyFeePricingTable,
  loadPartyFeePricingById,
  loadPartyFeePricingTables,
  savePartyFeePricingAssignments,
  savePartyFeePricingConfig,
} from "../lib/financial-api";

const CATEGORIES: {
  id: PartyFeePricingCategory;
  label: string;
  hint: string;
  partyLabel: string;
}[] = [
  {
    id: "engineering-survey",
    label: "المكاتب الهندسية",
    hint: "شرائح المساحة والأتعاب",
    partyLabel: "المكاتب",
  },
  {
    id: "government-review",
    label: "المراجعين الحكوميين",
    hint: "أتعاب الزيارة واستلام المفاتيح",
    partyLabel: "المراجعون",
  },
  {
    id: "field-inspector",
    label: "المعاينين الميدانيين",
    hint: "متعاون فرد أو منشأة",
    partyLabel: "المعاينون",
  },
];

function partiesForCategory(
  category: PartyFeePricingCategory,
  staffUsers: Parameters<typeof getEngineeringOffices>[0],
): DistributionAssignee[] {
  if (category === "engineering-survey") return getEngineeringOffices(staffUsers);
  if (category === "government-review") return getGovernmentAuditors(staffUsers);
  return getFieldInspectors(staffUsers);
}

function emptyDraft(
  category: PartyFeePricingCategory,
  partial?: Partial<PartyFeePricingDto>,
): PartyFeePricingDto {
  return {
    id: "",
    category,
    name: "",
    isActive: false,
    assignedCount: 0,
    assignedAssigneeIds: [],
    areaTiers:
      category === "engineering-survey"
        ? [
            { sortOrder: 0, maxAreaM2: 500, feeSar: 0 },
            { sortOrder: 1, maxAreaM2: null, feeSar: 0 },
          ]
        : [],
    governmentReviewFeeSar: 0,
    keyReceiptFeeSar: 0,
    fieldInspectorIndividualFeeSar: 0,
    fieldInspectorOrganizationFeeSar: 0,
    ...partial,
  };
}

function num(value: string): number {
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function reindexTiers(tiers: PartyFeePricingTierDto[]): PartyFeePricingTierDto[] {
  return tiers.map((t, i) => ({
    ...t,
    sortOrder: i,
    maxAreaM2: i === tiers.length - 1 ? null : t.maxAreaM2,
  }));
}

function tierFromValue(tiers: PartyFeePricingTierDto[], index: number): number {
  if (index === 0) return 0;
  const prev = tiers[index - 1]?.maxAreaM2;
  if (prev == null || prev <= 0) return 0;
  return prev;
}

function defaultTableName(count: number): string {
  return count === 0 ? "افتراضي" : `جدول ${count + 1}`;
}

function MoneyInput({
  id,
  value,
  locked,
  onChange,
  className,
}: {
  id?: string;
  value: number;
  locked: boolean;
  onChange: (n: number) => void;
  className?: string;
}) {
  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      dir="ltr"
      readOnly={locked}
      disabled={locked}
      className={cn("text-start tabular-nums", className)}
      value={value === 0 ? "" : String(value)}
      placeholder="0"
      onChange={(e) => onChange(num(e.target.value))}
    />
  );
}

export function FinancePartyFeePricing() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-system-config");
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const [selectedCategory, setSelectedCategory] =
    useState<PartyFeePricingCategory>("engineering-survey");
  const [tables, setTables] = useState<PartyFeePricingTableSummaryDto[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<PartyFeePricingDto>(
    emptyDraft("engineering-survey"),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDraft, setAssignDraft] = useState<string[]>([]);
  const locked = loading || saving || busy || !canEdit;

  const categoryParties = useMemo(
    () => partiesForCategory(selectedCategory, staffUsers),
    [selectedCategory, staffUsers],
  );

  const assignedNames = useMemo(() => {
    const ids = new Set(draft.assignedAssigneeIds ?? []);
    return categoryParties.filter((p) => ids.has(p.id));
  }, [categoryParties, draft.assignedAssigneeIds]);

  const refreshTables = async (
    category: PartyFeePricingCategory,
    preferId?: string,
  ) => {
    const list = await loadPartyFeePricingTables(category);
    setTables(list);
    const nextId =
      preferId && list.some((t) => t.id === preferId)
        ? preferId
        : list.find((t) => t.isActive)?.id ?? list[0]?.id ?? "";
    setSelectedId(nextId);
    return nextId;
  };

  const loadTable = async (id: string, category: PartyFeePricingCategory) => {
    if (!id) {
      setDraft(emptyDraft(category));
      return;
    }
    setDraft(await loadPartyFeePricingById(id));
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const id = await refreshTables(selectedCategory);
        if (cancelled) return;
        if (id) await loadTable(id, selectedCategory);
      } catch {
        if (!cancelled) showToast("تعذّر تحميل تسعير الأتعاب", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast, selectedCategory]);

  const selectCategory = async (category: PartyFeePricingCategory) => {
    if (category === selectedCategory) return;
    setSelectedCategory(category);
    setLoading(true);
    try {
      const id = await refreshTables(category);
      if (id) await loadTable(id, category);
      else setDraft(emptyDraft(category));
    } catch {
      showToast("تعذّر تحميل الفئة", "error");
    } finally {
      setLoading(false);
    }
  };

  const selectTable = async (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setLoading(true);
    try {
      await loadTable(id, selectedCategory);
    } catch {
      showToast("تعذّر تحميل الجدول", "error");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!draft.id) return;
    setSaving(true);
    try {
      const saved = await savePartyFeePricingConfig(draft.id, {
        ...draft,
        category: selectedCategory,
        areaTiers:
          selectedCategory === "engineering-survey"
            ? reindexTiers(draft.areaTiers)
            : [],
      });
      setDraft(saved);
      setTables((prev) =>
        prev.map((t) =>
          t.id === saved.id ? { ...t, name: saved.name, isActive: saved.isActive } : t,
        ),
      );
      await refreshTables(selectedCategory, saved.id);
      showToast("تم حفظ التسعيرة", "success");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر حفظ التسعير",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const createTable = async () => {
    setBusy(true);
    try {
      const created = await createPartyFeePricingTable(
        selectedCategory,
        defaultTableName(tables.length),
        selectedId || null,
      );
      await refreshTables(selectedCategory, created.id);
      setDraft(created);
      showToast("تم إنشاء جدول جديد", "success");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر إنشاء الجدول",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    if (!draft.id || draft.isActive) return;
    setBusy(true);
    try {
      const activated = await activatePartyFeePricingTable(draft.id);
      setDraft(activated);
      await refreshTables(selectedCategory, activated.id);
      showToast("صار هذا الجدول هو الافتراضي للفئة", "success");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر تعيين الافتراضي",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const openAssign = () => {
    setAssignDraft([...(draft.assignedAssigneeIds ?? [])]);
    setAssignOpen(true);
  };

  const toggleAssignee = (id: string) => {
    setAssignDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const saveAssignments = async () => {
    if (!draft.id) return;
    setBusy(true);
    try {
      const saved = await savePartyFeePricingAssignments(draft.id, assignDraft);
      setDraft(saved);
      await refreshTables(selectedCategory, saved.id);
      setAssignOpen(false);
      showToast("تم حفظ الإسناد", "success");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر حفظ الإسناد",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const removeTable = async () => {
    if (!draft.id || tables.length <= 1) return;
    if (!window.confirm(`حذف جدول «${draft.name}»؟ لا يمكن التراجع.`)) return;
    setBusy(true);
    try {
      await deletePartyFeePricingTable(draft.id);
      const nextId = await refreshTables(selectedCategory);
      if (nextId) await loadTable(nextId, selectedCategory);
      else setDraft(emptyDraft(selectedCategory));
      showToast("تم حذف الجدول", "success");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "تعذّر حذف الجدول",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const updateTier = (index: number, patch: Partial<PartyFeePricingTierDto>) => {
    setDraft((d) => {
      const next = d.areaTiers.map((t, i) =>
        i === index ? { ...t, ...patch } : t,
      );
      return { ...d, areaTiers: reindexTiers(next) };
    });
  };

  const updateTierFrom = (index: number, fromM2: number) => {
    if (index <= 0) return;
    setDraft((d) => {
      const next = d.areaTiers.map((t, i) =>
        i === index - 1 ? { ...t, maxAreaM2: fromM2 } : t,
      );
      return { ...d, areaTiers: reindexTiers(next) };
    });
  };

  const addTier = () => {
    setDraft((d) => {
      const closed = d.areaTiers.filter((t) => t.maxAreaM2 != null);
      const lastClosedMax =
        closed.length > 0
          ? Math.max(...closed.map((t) => t.maxAreaM2 ?? 0))
          : 500;
      const openFee =
        d.areaTiers.find((t) => t.maxAreaM2 == null)?.feeSar ?? 0;
      const next: PartyFeePricingTierDto[] = [
        ...closed,
        {
          sortOrder: closed.length,
          maxAreaM2: lastClosedMax + 500,
          feeSar: openFee,
        },
        { sortOrder: closed.length + 1, maxAreaM2: null, feeSar: openFee },
      ];
      return { ...d, areaTiers: reindexTiers(next) };
    });
  };

  const removeTier = (index: number) => {
    setDraft((d) => {
      if (d.areaTiers.length <= 1) return d;
      const next = d.areaTiers.filter((_, i) => i !== index);
      if (next.every((t) => t.maxAreaM2 != null)) {
        next[next.length - 1] = { ...next[next.length - 1], maxAreaM2: null };
      }
      return { ...d, areaTiers: reindexTiers(next) };
    });
  };

  const activeCategory = CATEGORIES.find((c) => c.id === selectedCategory);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      {!canEdit ? (
        <Note tone="default">
          عرض فقط — تعديل التسعيرة مقصور على المسؤول.
        </Note>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* يمين في RTL */}
        <aside className="w-full shrink-0 lg:w-60">
          <h2 className="m-0 mb-2 text-[13px] font-semibold text-text">الفئات</h2>
          <ul className="m-0 list-none space-y-1 rounded-md border border-border bg-surface p-1">
            {CATEGORIES.map((cat) => {
              const selected = cat.id === selectedCategory;
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    disabled={loading || busy}
                    onClick={() => void selectCategory(cat.id)}
                    className={cn(
                      "w-full rounded px-2.5 py-2 text-start transition-colors",
                      selected
                        ? "bg-primary/10 text-text"
                        : "text-text-2 hover:bg-surface-2",
                    )}
                  >
                    <span className="block text-[12.5px] font-semibold">
                      {cat.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-text-3">
                      {cat.hint}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-2">
            <h3 className="m-0 text-[12px] font-semibold text-text">
              جداول {activeCategory?.label}
            </h3>
            <Can capability="manage-system-config">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={locked}
                onClick={() => void createTable()}
              >
                إضافة
              </Button>
            </Can>
          </div>

          <ul className="mt-2 list-none space-y-1 rounded-md border border-border bg-surface p-1">
            {tables.length === 0 ? (
              <li className="px-3 py-4 text-center text-[12px] text-text-3">
                لا توجد جداول — أضف واحدًا
              </li>
            ) : (
              tables.map((t) => {
                const selected = t.id === selectedId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={loading || busy}
                      onClick={() => void selectTable(t.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-start transition-colors",
                        selected
                          ? "bg-primary/10 text-text"
                          : "text-text-2 hover:bg-surface-2",
                      )}
                    >
                      <span className="min-w-0 truncate text-[12px] font-medium">
                        {t.name || "بدون اسم"}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {(t.assignedCount ?? 0) > 0 ? (
                          <Badge tone="info" className="text-[10px]">
                            {t.assignedCount}
                          </Badge>
                        ) : null}
                        {t.isActive ? (
                          <Badge tone="success" className="text-[10px]">
                            افتراضي
                          </Badge>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <p className="mt-2 m-0 text-[11px] leading-relaxed text-text-3">
            أسند الجدول للأطراف المطلوبة. بدون إسناد: المكاتب الهندسية بلا
            تسعيرة، وباقي الفئات تستخدم الجدول الافتراضي.
          </p>
        </aside>

        <Card className="min-w-0 flex-1 overflow-hidden shadow-none">
          <CardBody className="space-y-6">
            {loading && !draft.id ? (
              <p className="m-0 text-[13px] text-text-3">جاري التحميل…</p>
            ) : !draft.id ? (
              <p className="m-0 text-[13px] text-text-3">
                اختر فئة وأضف جدولًا للبدء.
              </p>
            ) : (
              <>
                <div className="space-y-2 border-b border-border pb-4">
                  <Label
                    htmlFor="pricing-name"
                    className="m-0 text-[11px] font-semibold text-text-2"
                  >
                    اسم الجدول
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="pricing-name"
                      className="min-w-0 flex-1"
                      value={draft.name}
                      readOnly={locked}
                      disabled={locked}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, name: e.target.value }))
                      }
                    />
                    {draft.isActive ? (
                      <Badge tone="success" className="shrink-0">
                        افتراضي للفئة
                      </Badge>
                    ) : (
                      <Can capability="manage-system-config">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          disabled={locked}
                          onClick={() => void activate()}
                        >
                          تعيين كافتراضي
                        </Button>
                      </Can>
                    )}
                    <Can capability="manage-system-config">
                      <Button
                        type="button"
                        variant="accent"
                        size="sm"
                        className="shrink-0"
                        disabled={locked}
                        onClick={openAssign}
                      >
                        إسناد
                        {(draft.assignedCount ?? 0) > 0
                          ? ` (${draft.assignedCount})`
                          : ""}
                      </Button>
                    </Can>
                    <Can capability="manage-system-config">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        disabled={locked || tables.length <= 1}
                        onClick={() => void removeTable()}
                      >
                        حذف
                      </Button>
                    </Can>
                  </div>
                  {assignedNames.length > 0 ? (
                    <p className="m-0 text-[11px] text-text-3">
                      مسند إلى:{" "}
                      {assignedNames.map((p) => p.name).join("، ")}
                    </p>
                  ) : selectedCategory === "engineering-survey" ? (
                    <p className="m-0 text-[11px] text-amber">
                      لم يُسند لأي مكتب بعد — المكتب لا يستخدم هذا الجدول حتى
                      الإسناد.
                    </p>
                  ) : (
                    <p className="m-0 text-[11px] text-text-3">
                      بلا إسناد — يُستخدم الافتراضي عند الاحتساب إن وُجد.
                    </p>
                  )}
                </div>

                {selectedCategory === "engineering-survey" ? (
                  <section className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <h3 className="m-0 text-[13px] font-semibold text-text">
                          شرائح المساحة
                        </h3>
                        <p className="m-0 mt-0.5 text-[11px] text-text-3">
                          حدّد من/حتى والأتعاب. الصف الأخير لما فوقه.
                        </p>
                      </div>
                      <Can capability="manage-system-config">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={locked}
                          onClick={addTier}
                        >
                          إضافة شريحة
                        </Button>
                      </Can>
                    </div>
                    <div className="overflow-x-auto rounded-md border border-border">
                      <Table>
                        <THead>
                          <Tr>
                            <Th className="w-[28%]">من (م²)</Th>
                            <Th className="w-[28%]">حتى (م²)</Th>
                            <Th className="w-[32%]">الأتعاب (ر.س)</Th>
                            <Th className="w-[12%]" />
                          </Tr>
                        </THead>
                        <TBody>
                          {draft.areaTiers.map((tier, index) => {
                            const isLast = index === draft.areaTiers.length - 1;
                            return (
                              <Tr key={`${tier.sortOrder}-${index}`}>
                                <Td className="align-middle">
                                  <MoneyInput
                                    id={`tier-from-${index}`}
                                    value={tierFromValue(draft.areaTiers, index)}
                                    locked={locked || index === 0}
                                    onChange={(n) => updateTierFrom(index, n)}
                                  />
                                </Td>
                                <Td className="align-middle">
                                  {isLast ? (
                                    <span className="block px-1 text-[12.5px] text-text-2">
                                      فأكثر
                                    </span>
                                  ) : (
                                    <MoneyInput
                                      id={`tier-max-${index}`}
                                      value={tier.maxAreaM2 ?? 0}
                                      locked={locked}
                                      onChange={(n) =>
                                        updateTier(index, { maxAreaM2: n })
                                      }
                                    />
                                  )}
                                </Td>
                                <Td className="align-middle">
                                  <MoneyInput
                                    id={`tier-fee-${index}`}
                                    value={tier.feeSar}
                                    locked={locked}
                                    onChange={(n) =>
                                      updateTier(index, { feeSar: n })
                                    }
                                  />
                                </Td>
                                <Td className="align-middle text-center">
                                  <Can capability="manage-system-config">
                                    <button
                                      type="button"
                                      title="حذف الشريحة"
                                      disabled={
                                        locked || draft.areaTiers.length <= 1
                                      }
                                      onClick={() => removeTier(index)}
                                      className="rounded px-2 py-1 text-[12px] text-danger-text hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      حذف
                                    </button>
                                  </Can>
                                </Td>
                              </Tr>
                            );
                          })}
                        </TBody>
                      </Table>
                    </div>
                  </section>
                ) : null}

                {selectedCategory === "government-review" ? (
                  <section className="space-y-3">
                    <div>
                      <h3 className="m-0 text-[13px] font-semibold text-text">
                        أتعاب المراجع الحكومي
                      </h3>
                      <p className="m-0 mt-0.5 text-[11px] text-text-3">
                        أتعاب الزيارة تُستحق بإكمال مهمة زيارة محكمة؛ أتعاب
                        الاستلام عند تسجيل الظرف مع الصورة. متعاون فرد فقط.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormGroup>
                        <Label
                          htmlFor="fee-gov-review"
                          className="mb-1 text-[11px] font-semibold text-text-2"
                        >
                          أتعاب الزيارة — فرد (ر.س)
                        </Label>
                        <MoneyInput
                          id="fee-gov-review"
                          value={draft.governmentReviewFeeSar}
                          locked={locked}
                          onChange={(n) =>
                            setDraft((d) => ({
                              ...d,
                              governmentReviewFeeSar: n,
                            }))
                          }
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label
                          htmlFor="fee-key-receipt"
                          className="mb-1 text-[11px] font-semibold text-text-2"
                        >
                          أتعاب استلام المفاتيح (ر.س)
                        </Label>
                        <MoneyInput
                          id="fee-key-receipt"
                          value={draft.keyReceiptFeeSar}
                          locked={locked}
                          onChange={(n) =>
                            setDraft((d) => ({
                              ...d,
                              keyReceiptFeeSar: n,
                            }))
                          }
                        />
                      </FormGroup>
                    </div>
                  </section>
                ) : null}

                {selectedCategory === "field-inspector" ? (
                  <section className="space-y-3">
                    <div>
                      <h3 className="m-0 text-[13px] font-semibold text-text">
                        أتعاب المعاين الميداني
                      </h3>
                      <p className="m-0 mt-0.5 text-[11px] text-text-3">
                        معاين الموظف خارج التسعيرة — يُدخل يدويًا على السجل.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormGroup>
                        <Label
                          htmlFor="fee-insp-ind"
                          className="mb-1 text-[11px] font-semibold text-text-2"
                        >
                          معاين — فرد (ر.س)
                        </Label>
                        <MoneyInput
                          id="fee-insp-ind"
                          value={draft.fieldInspectorIndividualFeeSar}
                          locked={locked}
                          onChange={(n) =>
                            setDraft((d) => ({
                              ...d,
                              fieldInspectorIndividualFeeSar: n,
                            }))
                          }
                        />
                      </FormGroup>
                      <FormGroup>
                        <Label
                          htmlFor="fee-insp-org"
                          className="mb-1 text-[11px] font-semibold text-text-2"
                        >
                          معاين — منشأة (ر.س)
                        </Label>
                        <MoneyInput
                          id="fee-insp-org"
                          value={draft.fieldInspectorOrganizationFeeSar}
                          locked={locked}
                          onChange={(n) =>
                            setDraft((d) => ({
                              ...d,
                              fieldInspectorOrganizationFeeSar: n,
                            }))
                          }
                        />
                      </FormGroup>
                    </div>
                  </section>
                ) : null}

                <Can capability="manage-system-config">
                  <div className="flex justify-end border-t border-border pt-4">
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      disabled={locked || !draft.id}
                      onClick={() => void save()}
                    >
                      {saving ? "جاري الحفظ…" : "حفظ التسعيرة"}
                    </Button>
                  </div>
                </Can>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {assignOpen ? (
        <ModalOverlay role="presentation" onClick={() => setAssignOpen(false)}>
          <ModalCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-assign-title"
            className="max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader>
              <div className="min-w-0 flex-1">
                <ModalTitle id="pricing-assign-title">
                  إسناد «{draft.name}»
                </ModalTitle>
                <p className="m-0 mt-1 text-[12px] text-text-3">
                  اختر {activeCategory?.partyLabel ?? "الأطراف"} لهذا الجدول
                </p>
              </div>
              <ModalClose onClick={() => setAssignOpen(false)} />
            </ModalHeader>
            <ModalBody className="max-h-[50vh] space-y-1 overflow-y-auto">
              {categoryParties.length === 0 ? (
                <Note tone="warning">
                  لا يوجد أطراف متاحون لهذه الفئة (تحقق من معرّف التوزيع).
                </Note>
              ) : (
                categoryParties.map((party) => {
                  const checked = assignDraft.includes(party.id);
                  return (
                    <label
                      key={party.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors",
                        checked
                          ? "border-primary/40 bg-primary/5"
                          : "border-border hover:bg-surface-2",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={() => toggleAssignee(party.id)}
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-text">
                          {party.name}
                        </span>
                        {party.subtitle ? (
                          <span className="mt-0.5 block text-[11px] text-text-3">
                            {party.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={busy}
                onClick={() => void saveAssignments()}
              >
                {busy ? "جاري الحفظ…" : "حفظ الإسناد"}
              </Button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
