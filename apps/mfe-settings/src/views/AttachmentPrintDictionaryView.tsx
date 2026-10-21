"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import type { ValuationListItemDto } from "@platform/api-client";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  MobileRecordCard,
  MobileRecordList,
  MobileSectionPicker,
  ModalBody,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Note,
  PageShell,
  Select,
  PageLoadingHint,
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
  useSwapAnimation,
} from "@platform/ui-kit";

import {
  PROPERTY_TYPE_SPLIT_RE,
  TABS,
  listDataColumnLabels,
  rowCellsForList,
  valuationListInlineInputClassName,
  valuationListThClass,
} from "../lib/valuation-lists-view-state";
import {
  ListItemAddModal,
  ValuationListColGroup,
} from "./ValuationListsPanels";
import { useValuationListsWorkflow } from "./useValuationListsWorkflow";

type PatchRow = (id: string, patch: Partial<ValuationListItemDto>) => void;

/** Phone-card field control: full width, label above, 44px tall. */
const phoneFieldClass = "h-11 w-full min-w-0 text-[14px]";

/**
 * The editable middle columns of one list row — the attachments list has a
 * required select + property-types input, every other list plain text cells.
 * Shared by the table cells and the phone card (`variant` sets the chrome).
 */
function listRowMiddleEditors(
  tab: string,
  row: ValuationListItemDto,
  patchRow: PatchRow,
  variant: "cell" | "card",
): ReactNode[] {
  const card = variant === "card";
  if (tab === "attachments") {
    return [
      <Select
        key="required"
        className={card ? phoneFieldClass : "h-8 w-full min-w-0 text-[12.5px]"}
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
      </Select>,
      <Input
        key="types"
        className={card ? phoneFieldClass : "h-8 w-full min-w-0 text-[12.5px]"}
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
      />,
    ];
  }
  return rowCellsForList(tab, row).map((cell, idx) => {
    const onChange = (value: string) => {
      const cells = rowCellsForList(tab, row);
      cells[idx] = value;
      patchRow(row.id, { cells });
    };
    return card ? (
      <Input
        key={`${row.id}-c-${idx}`}
        className={phoneFieldClass}
        value={cell}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : (
      <input
        key={`${row.id}-c-${idx}`}
        value={cell}
        onChange={(e) => onChange(e.target.value)}
        className={valuationListInlineInputClassName()}
      />
    );
  });
}

/** Phones: one editable card per list item — the fixed table squeezed every input. */
function ListItemPhoneCard({
  tab,
  row,
  patchRow,
  onDelete,
}: {
  tab: string;
  row: ValuationListItemDto;
  patchRow: PatchRow;
  onDelete: () => void;
}) {
  const labels = listDataColumnLabels(tab);
  const middleLabels = labels.slice(1, -1);
  const usageLabel = labels[labels.length - 1] ?? "الاستخدام";
  const changed = row.name !== row.defaultName;
  const editors = listRowMiddleEditors(tab, row, patchRow, "card");
  return (
    <MobileRecordCard
      tone={changed ? "gold" : undefined}
      title={row.name || row.defaultName || "—"}
      subtitle={changed ? `الافتراضي: ${row.defaultName}` : undefined}
      fields={[{ label: usageLabel, value: row.usage, ltr: true }]}
      actions={
        <Button variant="dangerOutline" size="lg" className="w-full" onClick={onDelete}>
          حذف
        </Button>
      }
    >
      <div className="flex flex-col gap-2.5">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[11.5px] font-medium text-text-3">{labels[0] ?? "الاسم"}</span>
          <Input
            className={cn(phoneFieldClass, "font-medium")}
            value={row.name}
            onChange={(e) => patchRow(row.id, { name: e.target.value })}
          />
        </label>
        {editors.map((editor, idx) => (
          <label key={`${row.id}-m-${idx}`} className="flex min-w-0 flex-col gap-1">
            <span className="text-[11.5px] font-medium text-text-3">{middleLabels[idx] ?? ""}</span>
            {editor}
          </label>
        ))}
      </div>
    </MobileRecordCard>
  );
}

/**
 * Valuation lists / attachment print dictionary — a tab per catalogue with an
 * inline-editable table, plus the IVS date, photo pages, certified valuer and
 * report parts panels. All state lives in `useValuationListsWorkflow`.
 */
export function AttachmentPrintDictionaryView() {
  const {
    tab,
    setTab,
    meta,
    tableMeta,
    catalog,
    rows,
    loading,
    saving,
    error,
    modal,
    setModal,
    addModalOpen,
    setAddModalOpen,
    addDraft,
    setAddDraft,
    addSaving,
    scheduleAutosave,
    patchRow,
    openAddModal,
    confirmAddItem,
    requestDeleteRow,
    persistCatalog,
  } = useValuationListsWorkflow();
  const panelRef = useRef<HTMLDivElement>(null);
  useSwapAnimation(panelRef, tab);

  if (loading) {
    return (
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
        <PageLoadingHint className="py-20" />
      </PageShell>
    );
  }

  return (
    <PageShell variant="canvas" className="gap-0 p-4 sm:p-6" dir="rtl">
      {error ? <Note tone="warn" className="mb-3">{error}</Note> : null}

      {/* Phones: the side list-menu becomes a section picker above full-width cards. */}
      <MobileSectionPicker
        className="mb-3 lg:hidden"
        title="القائمة"
        sections={TABS.map((item) => ({ id: item.id, label: item.label }))}
        active={tab}
        onChange={setTab}
      />

      <div className="flex items-start gap-4">
        <nav className="flex w-[190px] shrink-0 flex-col gap-1.5 max-lg:hidden" aria-label="قوائم التقييم">
          {TABS.map((item) => {
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-2.5 text-start font-[inherit] text-[13px]",
                  "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.985]",
                  "motion-reduce:transition-none motion-reduce:active:scale-100",
                  active
                    ? "border border-gold border-s-[3px] bg-gold-soft font-bold text-gold-d"
                    : "border border-border bg-surface font-medium text-text-2 hover:border-border-md hover:bg-row-hover",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div ref={panelRef} className="min-w-0 flex-1">
          {meta.kind === "ivs" && catalog ? (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3.5">
              <div className="flex min-w-[16rem] flex-col">
                <Label>تاريخ سريان معايير التقييم الدولية (يدوي)</Label>
                <Input
                  value={catalog.ivsEffectiveDate}
                  onChange={(e) =>
                    scheduleAutosave({ ...catalog, ivsEffectiveDate: e.target.value })
                  }
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
                        scheduleAutosave({
                          ...catalog,
                          photoPagesLand: Number(e.target.value),
                        })
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
                        scheduleAutosave({
                          ...catalog,
                          photoPagesBuilt: Number(e.target.value),
                        })
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

          {meta.kind === "table" && tableMeta ? (
            <>
              <div className="mb-3 flex flex-wrap gap-2.5 max-lg:flex-col">
                <Button
                  variant="default"
                  size="sm"
                  className="max-lg:h-11 max-lg:w-full max-lg:text-sm"
                  onClick={openAddModal}
                >
                  {tableMeta.addLabel}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="max-lg:h-11 max-lg:w-full max-lg:border-border-md max-lg:text-sm"
                  onClick={() => {
                    const changed = rows.filter(
                      (r) => r.name !== r.defaultName,
                    ).length;
                    setModal({
                      title: "استعادة الافتراضي",
                      body: changed
                        ? `سيُعاد ${changed} عنصراً إلى قيمته الافتراضية. الإضافات الجديدة تبقى.`
                        : "لا خروج عن الافتراضي في هذه القائمة.",
                      confirm: "استعادة",
                      onConfirm: () => {
                        if (!catalog) return;
                        const nextRows = rows.map((r) => ({
                          ...r,
                          name: r.defaultName || r.name,
                        }));
                        void persistCatalog({
                          ...catalog,
                          lists: { ...catalog.lists, [tab]: nextRows },
                        });
                      },
                    });
                  }}
                >
                  استعادة الافتراضي
                </Button>
              </div>
              <MobileRecordList
                className="lg:hidden"
                isEmpty={rows.length === 0}
                empty="لا توجد عناصر في هذه القائمة."
              >
                {rows.map((row) => (
                  <ListItemPhoneCard
                    key={row.id}
                    tab={tab}
                    row={row}
                    patchRow={patchRow}
                    onDelete={() => requestDeleteRow(row)}
                  />
                ))}
              </MobileRecordList>
              <TableFrame className="w-full max-lg:hidden">
                <Table className="table-fixed">
                  <ValuationListColGroup tab={tab} />
                  <THead>
                    <Tr hoverable={false}>
                      {listDataColumnLabels(tab).map((label, idx) => (
                        <Th
                          key={`${tab}-head-${idx}`}
                          className={valuationListThClass(label, idx)}
                        >
                          {label}
                        </Th>
                      ))}
                      <ThAction className="!w-[4.75rem]" aria-label="إجراءات" />
                    </Tr>
                  </THead>
                  <TBody>
                    {rows.length === 0 ? (
                      <TableEmptyRow colSpan={listDataColumnLabels(tab).length + 1}>
                        لا توجد عناصر في هذه القائمة.
                      </TableEmptyRow>
                    ) : (
                      rows.map((row) => (
                        <Tr key={row.id} hoverable={false}>
                          <Td className="min-w-0 align-middle">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <input
                                value={row.name}
                                onChange={(e) => patchRow(row.id, { name: e.target.value })}
                                className={cn(
                                  valuationListInlineInputClassName(),
                                  "font-medium",
                                )}
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
                          {listRowMiddleEditors(tab, row, patchRow, "cell").map((editor, idx) => (
                            <Td key={`${row.id}-c-${idx}`} className="min-w-0 align-middle">
                              {editor}
                            </Td>
                          ))}
                          <Td className="text-center align-middle">
                            <bdi className="font-mono tabular-nums">{row.usage}</bdi>
                          </Td>
                          <TdAction className="!w-[4.75rem]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-danger-text hover:text-danger-text"
                              onClick={() => requestDeleteRow(row)}
                            >
                              حذف
                            </Button>
                          </TdAction>
                        </Tr>
                      ))
                    )}
                  </TBody>
                </Table>
              </TableFrame>
              <p className="mx-0.5 mt-2.5 mb-0 text-[11.5px] text-text-3">{tableMeta.note}</p>
            </>
          ) : null}
        </div>
      </div>

      {addModalOpen && tableMeta ? (
        <ListItemAddModal
          listId={tab}
          title={tableMeta.addTitle}
          draft={addDraft}
          saving={addSaving}
          onDraftChange={setAddDraft}
          onClose={() => {
            if (!addSaving) setAddModalOpen(false);
          }}
          onSave={() => void confirmAddItem()}
        />
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
                  void Promise.resolve(modal.onConfirm()).finally(() => setModal(null));
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
