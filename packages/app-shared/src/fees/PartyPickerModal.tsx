"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Input,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  cn,
} from "@platform/design-system";
import type { PartyFeeGroup } from "./party-fee-meta";

const CATEGORIES = [
  "all",
  "المكاتب الهندسية",
  "المعاينون",
  "المراجعون الحكوميون",
] as const;

export function PartyPickerModal({
  open,
  parties,
  selectedAssigneeId,
  onClose,
  onSelect,
}: {
  open: boolean;
  parties: PartyFeeGroup[];
  selectedAssigneeId: string;
  onClose: () => void;
  onSelect: (assigneeId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("all");

  const filtered = useMemo(() => {
    const q = search.trim();
    return parties.filter((party) => {
      if (category !== "all" && party.category !== category) return false;
      if (!q) return true;
      return party.name.includes(q) || party.assigneeId.includes(q);
    });
  }, [category, parties, search]);

  if (!open) return null;

  let lastCategory = "";

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard wide onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>اختيار الطرف</ModalTitle>
          <ModalClose onClick={onClose} aria-label="إغلاق">
            ×
          </ModalClose>
        </ModalHeader>
        <ModalBody className="pt-2">
          <Input
            className="mb-3 text-sm"
            placeholder="ابحث باسم الطرف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mb-3 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                type="button"
                size="sm"
                variant={category === cat ? "primary" : "outline"}
                onClick={() => setCategory(cat)}
              >
                {cat === "all" ? "الكل" : cat}
              </Button>
            ))}
          </div>
          <div className="max-h-80 overflow-auto rounded-[var(--radius-lg)] border border-border">
            {filtered.length === 0 ? (
              <p className="p-5 text-center text-sm text-text-3">لا نتائج</p>
            ) : (
              filtered.map((party) => {
                const showHeader = party.category !== lastCategory;
                if (showHeader) lastCategory = party.category;
                return (
                  <div key={party.assigneeId}>
                    {showHeader ? (
                      <div className="border-t border-border bg-surface-2 px-3 py-2 text-[11px] text-text-3 first:border-t-0">
                        {party.category}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between border-t border-border px-3 py-2.5 text-start text-sm hover:bg-surface-2",
                        party.assigneeId === selectedAssigneeId &&
                          "bg-primary/5 font-semibold",
                      )}
                      onClick={() => {
                        onSelect(party.assigneeId);
                        onClose();
                      }}
                    >
                      <span>{party.name}</span>
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-3">
                        {party.rows.length} عقار
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </ModalBody>
      </ModalCard>
    </ModalOverlay>
  );
}
