"use client";

import {
  Button,
  Input,
  Label,
  ModalBody,
  ModalCard,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  Select,
  Table,
  cn,
} from "@platform/ui-kit";

import {
  PROPERTY_TYPE_SPLIT_RE,
  TABLE_META,
  listDataColumnLabels,
  valuationListMiddleCount,
  type AddItemDraft,
} from "../lib/valuation-lists-view-state";

/**
 * Presentational pieces of the valuation lists screen — the RTL column group,
 * and the add-item modal.
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
      <span
        className={`text-[13px] font-medium${ltr ? " text-right tabular-nums" : ""}`}
        dir={ltr ? "ltr" : undefined}
      >
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
