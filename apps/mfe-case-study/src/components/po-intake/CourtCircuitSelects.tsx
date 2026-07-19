"use client";

import { useEffect, useMemo, useState } from "react";
import { RegSelect } from "@platform/app-shared/registration/FormFields";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import {
  listSelectableCircuits,
  listSelectableCourts,
  type SelectableCircuitDto,
  type SelectableCourtDto,
} from "@platform/api-client";
import { courtsApiConfig } from "@settings/mfe/lib/settings-api-config";
import type { PoPropertyIntake } from "../../lib/prototype/po-intake-data";

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

  const selectedCourtId = useMemo(() => {
    if (propertyCourtId?.trim()) return propertyCourtId.trim();
    const byName = courts.find((row) => row.name === court.trim());
    return byName?.id ?? "";
  }, [propertyCourtId, courts, court]);

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

  const selectedCircuitId = useMemo(() => {
    if (propertyCircuitId?.trim()) return propertyCircuitId.trim();
    const byNo = circuits.find(
      (row) =>
        row.circuitNo === circuit.trim() ||
        row.circuitName === circuit.trim(),
    );
    return byNo?.id ?? "";
  }, [propertyCircuitId, circuits, circuit]);

  const courtOptions = useMemo(() => {
    const options = courts.map((row) => ({
      value: row.id,
      label: row.name,
    }));
    if (
      selectedCourtId &&
      !options.some((option) => option.value === selectedCourtId) &&
      court.trim()
    ) {
      options.unshift({
        value: selectedCourtId,
        label: court.trim(),
      });
    }
    return options;
  }, [courts, selectedCourtId, court]);

  const circuitOptions = useMemo(() => {
    const options = circuits.map((row) => ({
      value: row.id,
      label: row.circuitName?.trim() || row.circuitNo,
    }));
    if (
      selectedCircuitId &&
      !options.some((option) => option.value === selectedCircuitId) &&
      circuit.trim()
    ) {
      options.unshift({
        value: selectedCircuitId,
        label: circuit.trim(),
      });
    }
    return options;
  }, [circuits, selectedCircuitId, circuit]);

  return (
    <>
      <RegSelect
        id={courtId}
        label="المحكمة"
        required
        options={courtOptions}
        value={selectedCourtId}
        error={fieldErrors.court}
        placeholder="اختر المحكمة..."
        onChange={(value) => {
          const selected = courts.find((row) => row.id === value);
          onPatch("courtId", value || "");
          onPatch("court", selected?.name ?? "");
          onPatch("circuitId", "");
          onPatch("circuit", "");
        }}
      />
      <RegSelect
        id={circuitId}
        label="الدائرة"
        required
        options={circuitOptions}
        value={selectedCircuitId}
        error={fieldErrors.circuit}
        disabled={!selectedCourtId}
        placeholder="اختر الدائرة..."
        onChange={(value) => {
          const selected = circuits.find((row) => row.id === value);
          onPatch("circuitId", value || "");
          onPatch(
            "circuit",
            selected?.circuitName?.trim() || selected?.circuitNo || "",
          );
        }}
      />
    </>
  );
}
