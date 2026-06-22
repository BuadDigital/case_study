"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { RegField, RegSelect } from "@platform/app-shared/registration/FormFields";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { CITY_OPTIONS } from "@case-study/mfe";
import {
  Badge,
  Button,
  Note,
  PageGutter,
  SubpageHeader,
  SubpagePanel,
  useToast,
} from "@platform/design-system";
import { canManageCourts } from "../lib/settings-roles";
import { saveCourtsCatalog } from "../lib/prototype/courts-storage";
import { useCourtsCatalogQuery } from "../query/settings-queries";

function newCourtId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `c-${Date.now()}`;
}

export function CourtsView() {
  const queryClient = useQueryClient();
  const { role } = usePrototype();
  const canEdit = canManageCourts(role);
  const { data: entries = [], refetch } = useCourtsCatalogQuery();
  const [city, setCity] = useState<string>(CITY_OPTIONS[0]);
  const [court, setCourt] = useState("");
  const [circuitInput, setCircuitInput] = useState("");
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: prototypeKeys.courtsCatalog(),
    });
    await refetch();
  }, [queryClient, refetch]);

  async function handleAdd() {
    if (!canEdit || busy) return;
    const courtName = court.trim();
    const circuit = circuitInput.trim();
    if (!courtName || !circuit) {
      showToast("أدخل اسم المحكمة والدائرة", "error");
      return;
    }
    const list = [...entries];
    const existing = list.find((e) => e.city === city && e.court === courtName);
    if (existing) {
      if (existing.circuits.includes(circuit)) {
        showToast("هذه الدائرة مسجّلة مسبقاً", "error");
        return;
      }
      existing.circuits.push(circuit);
    } else {
      list.push({
        id: newCourtId(),
        city,
        court: courtName,
        circuits: [circuit],
      });
    }
    setBusy(true);
    const ok = await saveCourtsCatalog(list);
    setBusy(false);
    if (!ok) {
      showToast("تعذّر الحفظ — تحقق من تسجيل الدخول والخادم", "error");
      return;
    }
    await refresh();
    setCourt("");
    setCircuitInput("");
    showToast("تمت الإضافة", "success");
  }

  async function handleRemove(id: string, circuit?: string) {
    if (!canEdit || busy) return;
    const list = [...entries];
    const idx = list.findIndex((e) => e.id === id);
    if (idx < 0) return;
    if (circuit) {
      list[idx] = {
        ...list[idx],
        circuits: list[idx].circuits.filter((c) => c !== circuit),
      };
      if (list[idx].circuits.length === 0) list.splice(idx, 1);
    } else {
      list.splice(idx, 1);
    }
    setBusy(true);
    const ok = await saveCourtsCatalog(list);
    setBusy(false);
    if (!ok) {
      showToast("تعذّر الحفظ", "error");
      return;
    }
    await refresh();
    showToast("تم الحذف", "success");
  }

  const grouped = CITY_OPTIONS.map((c) => ({
    city: c,
    rows: entries.filter((e) => e.city === c),
  })).filter((g) => g.rows.length > 0);

  return (
    <>
      {!canEdit ? (
        <Note tone="info" className="mb-4">
          عرض فقط — إدارة القائمة للمشرف.
        </Note>
      ) : (
        <SubpagePanel className="mb-0">
          <SubpageHeader title="إضافة محكمة / دائرة" />
          <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2 sm:px-6">
            <RegSelect
              id="court_city"
              label="المدينة"
              options={[...CITY_OPTIONS]}
              value={city}
              onChange={setCity}
            />
            <RegField
              id="court_name"
              label="المحكمة"
              value={court}
              onChange={setCourt}
            />
            <RegField
              id="circuit_name"
              label="الدائرة"
              value={circuitInput}
              onChange={setCircuitInput}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={busy}
                disabled={busy}
                onClick={() => void handleAdd()}
              >
                + إضافة
              </Button>
            </div>
          </div>
        </SubpagePanel>
      )}

      <SubpagePanel>
        <SubpageHeader title="قائمة المحاكم والدوائر" />
        {grouped.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-text-3 sm:px-6">
            لا توجد محاكم — يبدأ النظام بقائمة افتراضية عند أول فتح.
          </p>
        ) : (
          grouped.map(({ city: c, rows }) => (
            <PageGutter key={c} className="border-t border-border py-3">
              <div className="mb-2 text-[13px] font-bold text-text">{c}</div>
              {rows.map((row) => (
                <div key={row.id} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{row.court}</span>
                    {canEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="dangerOutline"
                        loading={busy}
                        disabled={busy}
                        onClick={() => void handleRemove(row.id)}
                      >
                        حذف المحكمة
                      </Button>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {row.circuits.map((circuit) => (
                      <Badge
                        key={circuit}
                        tone="warning"
                        className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal"
                      >
                        {circuit}
                        {canEdit ? (
                          <button
                            type="button"
                            style={{
                              marginRight: 6,
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              color: "var(--danger)",
                            }}
                            aria-label={`حذف ${circuit}`}
                            onClick={() => void handleRemove(row.id, circuit)}
                          >
                            ×
                          </button>
                        ) : null}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </PageGutter>
          ))
        )}
      </SubpagePanel>
    </>
  );
}
