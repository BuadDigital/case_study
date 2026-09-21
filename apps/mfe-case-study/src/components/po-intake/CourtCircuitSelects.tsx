"use client";

import { useEffect, useMemo, useState } from "react";
import { RegSearchSelect } from "@platform/app-shared/registration/RegSearchSelect";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import {
  circuitDisplayLabel,
  filterAndRankCircuits,
  findLinkedCircuit,
} from "@platform/app-shared/domain/courts/circuit-search";
import {
  listSelectableCircuits,
  listSelectableCourts,
  type SelectableCircuitDto,
  type SelectableCourtDto,
} from "@platform/api-client";
import {
  Badge,
  Button,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
} from "@platform/ui-kit";
import { courtsApiConfig } from "@settings/mfe/lib/settings-api-config";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import {
  CUSTOM_CIRCUIT_VALUE,
  isCustomCircuitValue,
  isCustomCourtValue,
  resolveSelectedCircuitId,
  resolveSelectedCourtId,
} from "./court-circuit-select-state";

type Props = {
  courtId: string;
  circuitId: string;
  court: string;
  circuit: string;
  propertyCourtId?: string;
  propertyCircuitId?: string;
  fieldErrors: FieldErrors;
  onPatch: <K extends keyof PoPropertyIntake>(
    key: K,
    value: PoPropertyIntake[K],
  ) => void;
};

type SuggestPrompt = {
  nameAr: string;
  similar: SelectableCircuitDto[];
};

export function CourtCircuitSelects({
  courtId,
  circuitId,
  court,
  circuit,
  propertyCourtId,
  propertyCircuitId,
  fieldErrors,
  onPatch,
}: Props) {
  const [courts, setCourts] = useState<SelectableCourtDto[]>([]);
  const [circuits, setCircuits] = useState<SelectableCircuitDto[]>([]);
  const [suggestPrompt, setSuggestPrompt] = useState<SuggestPrompt | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const config = courtsApiConfig();
    if (!config) {
      setCourts([]);
      return;
    }
    void listSelectableCourts(config).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setCourts([]);
        return;
      }
      setCourts(result.courts);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCourtValue = useMemo(
    () => resolveSelectedCourtId({ propertyCourtId, court, courts }),
    [propertyCourtId, courts, court],
  );
  const isCustomCourt = isCustomCourtValue(selectedCourtValue);
  // A typed court has no catalog id, so it has no catalog circuits either.
  const selectedCourtId = isCustomCourt ? "" : selectedCourtValue;

  useEffect(() => {
    let cancelled = false;
    if (!selectedCourtId) {
      setCircuits([]);
      return;
    }
    const config = courtsApiConfig();
    if (!config) {
      setCircuits([]);
      return;
    }
    void listSelectableCircuits(config, selectedCourtId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setCircuits([]);
        return;
      }
      setCircuits(result.circuits);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCourtId]);

  const selectedCircuitId = useMemo(
    () =>
      resolveSelectedCircuitId({
        propertyCircuitId,
        circuit,
        circuits,
      }),
    [propertyCircuitId, circuits, circuit],
  );

  const courtOptions = useMemo(() => {
    const options = courts.map((row) => ({
      value: row.id,
      label: row.name,
    }));
    if (
      selectedCourtValue &&
      !options.some((option) => option.value === selectedCourtValue) &&
      court.trim()
    ) {
      options.unshift({
        value: selectedCourtValue,
        label: court.trim(),
      });
    }
    return options;
  }, [courts, selectedCourtValue, court]);

  const circuitOptions = useMemo(() => {
    const options = circuits.map((row) => ({
      value: row.id,
      label: circuitDisplayLabel(row),
    }));
    if (
      isCustomCircuitValue(selectedCircuitId) &&
      circuit.trim() &&
      !options.some((option) => option.label === circuit.trim())
    ) {
      options.unshift({
        value: CUSTOM_CIRCUIT_VALUE,
        label: circuit.trim(),
      });
    }
    return options;
  }, [circuits, selectedCircuitId, circuit]);

  const applyCatalogCircuit = (row: SelectableCircuitDto) => {
    onPatch("circuitId", row.id);
    onPatch("circuit", row.circuitNo);
  };

  const applyCustomCircuit = (name: string) => {
    onPatch("circuitId", "");
    onPatch("circuit", name.trim());
  };

  const createOrLinkCircuit = (query: string) => {
    const q = query.trim();
    if (!q || !selectedCourtValue) return;
    if (!selectedCourtId) {
      applyCustomCircuit(q);
      setSuggestPrompt(null);
      return;
    }
    const linked = findLinkedCircuit(circuits, q);
    if (linked) {
      applyCatalogCircuit(linked);
      setSuggestPrompt(null);
      return;
    }
    const similar = filterAndRankCircuits(circuits, q);
    if (similar.length > 0) {
      setSuggestPrompt({ nameAr: q, similar });
      return;
    }
    applyCustomCircuit(q);
    setSuggestPrompt(null);
  };

  const createOrLinkCourt = (query: string) => {
    const q = query.trim();
    if (!q) return;
    const linked = courts.find((row) => row.name === q);
    onPatch("courtId", linked?.id ?? "");
    onPatch("court", linked?.name ?? q);
    onPatch("circuitId", "");
    onPatch("circuit", "");
    setSuggestPrompt(null);
  };

  const isCustom = isCustomCircuitValue(selectedCircuitId);

  return (
    <>
      <div>
        <RegSearchSelect
          id={courtId}
          label="المحكمة"
          required
          options={courtOptions}
          value={selectedCourtValue}
          error={fieldErrors.court}
          placeholder="اختر المحكمة أو اكتب اسمها…"
          hint="إن لم تكن المحكمة في الدليل اكتب اسمها وأضفها كمحكمة مبدئية"
          createMinLength={2}
          createLabel={(q) => `إضافة «${q}» كمحكمة مبدئية`}
          onCreate={createOrLinkCourt}
          onChange={(value) => {
            if (isCustomCourtValue(value)) return;
            const selected = courts.find((row) => row.id === value);
            onPatch("courtId", value || "");
            onPatch("court", selected?.name ?? "");
            onPatch("circuitId", "");
            onPatch("circuit", "");
            setSuggestPrompt(null);
          }}
        />
        {isCustomCourt ? (
          <Badge tone="warning" className="mt-1">
            مسمّى محكمة مبدئي
          </Badge>
        ) : null}
      </div>
      <div>
        <RegSearchSelect
          id={circuitId}
          label="الدائرة"
          required
          options={circuitOptions}
          value={selectedCircuitId}
          error={fieldErrors.circuit}
          disabled={!selectedCourtValue}
          placeholder={
            selectedCourtValue
              ? "اكتب رقم أو اسم الدائرة…"
              : "اختر المحكمة أولاً"
          }
          hint="اكتب الرقم للوصول السريع — أو أضف دائرة مبدئية إن لم تكن في الدليل"
          inputMode="search"
          createMinLength={1}
          createLabel={(q) => `إضافة «${q}» كدائرة مبدئية`}
          onCreate={createOrLinkCircuit}
          filterOptions={(opts, query) => {
            const byId = new Map(circuits.map((c) => [c.id, c]));
            const items = opts
              .filter((o) => !isCustomCircuitValue(o.value))
              .map((o) => {
                const row = byId.get(o.value);
                return row
                  ? { ...row, id: o.value }
                  : {
                      id: o.value,
                      circuitNo: o.label,
                      circuitName: o.label,
                    };
              });
            const ranked = filterAndRankCircuits(items, query);
            const labelById = new Map(opts.map((o) => [o.value, o.label]));
            const rankedOpts = ranked.map((row) => ({
              value: row.id,
              label: labelById.get(row.id) ?? circuitDisplayLabel(row),
            }));
            if (
              isCustomCircuitValue(selectedCircuitId) &&
              circuit.trim() &&
              (!query.trim() ||
                circuit.trim().includes(query.trim()) ||
                query.trim().includes(circuit.trim()))
            ) {
              rankedOpts.unshift({
                value: CUSTOM_CIRCUIT_VALUE,
                label: circuit.trim(),
              });
            }
            return rankedOpts;
          }}
          onChange={(value) => {
            if (!value) {
              onPatch("circuitId", "");
              onPatch("circuit", "");
              return;
            }
            if (isCustomCircuitValue(value)) {
              onPatch("circuitId", "");
              if (!circuit.trim()) onPatch("circuit", "");
              return;
            }
            const selected = circuits.find((row) => row.id === value);
            onPatch("circuitId", value || "");
            onPatch("circuit", selected?.circuitNo ?? "");
          }}
        />
        {isCustom ? (
          <Badge tone="warning" className="mt-1">
            مسمّى دائرة مبدئي
          </Badge>
        ) : null}
      </div>

      {suggestPrompt ? (
        <ModalOverlay
          role="presentation"
          onClick={() => setSuggestPrompt(null)}
        >
          <ModalCard className="max-w-md" onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>دوائر مشابهة موجودة</ModalTitle>
              <ModalClose
                aria-label="إغلاق"
                onClick={() => setSuggestPrompt(null)}
              >
                ×
              </ModalClose>
            </ModalHeader>
            <ModalBody>
              <p className="mb-3 text-xs text-text-2">
                هل تقصد إحدى هذه الدوائر بدل «{suggestPrompt.nameAr}»؟
              </p>
              <ul className="space-y-1.5">
                {suggestPrompt.similar.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-[var(--radius-DEFAULT)] border border-border px-3 py-2 text-start text-xs hover:bg-surface-2"
                      onClick={() => {
                        applyCatalogCircuit(item);
                        setSuggestPrompt(null);
                      }}
                    >
                      <span>{circuitDisplayLabel(item)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSuggestPrompt(null)}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={() => {
                  applyCustomCircuit(suggestPrompt.nameAr);
                  setSuggestPrompt(null);
                }}
              >
                لا، أضف الاسم الجديد
              </Button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </>
  );
}
