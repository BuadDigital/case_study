"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import {
  createAdminCourt,
  createAdminCourtCircuit,
  getAdminCourt,
  listAdminCourts,
  setAdminCourtCircuitStatus,
  setAdminCourtStatus,
  updateAdminCourt,
  updateAdminCourtCircuit,
  type AdminCourtCircuitDto,
  type AdminCourtDetailDto,
  type AdminCourtDto,
  type CourtCircuitDraftDto,
  type CourtDraftDto,
  type CourtsAdminResult,
} from "@platform/api-client";
import {
  Badge,
  Button,
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
  Select,
  Spinner,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from "@platform/design-system";
import { courtsApiConfig } from "../lib/settings-api-config";

const REGION_CITIES: Record<string, string[]> = {
  "منطقة مكة المكرمة": ["مكة المكرمة", "جدة", "الطائف"],
  "منطقة الرياض": ["الرياض"],
  "منطقة المدينة المنورة": ["المدينة المنورة"],
  "المنطقة الشرقية": ["الدمام"],
  "منطقة أخرى": ["أخرى"],
};

function regionForCity(city: string): string | undefined {
  return Object.entries(REGION_CITIES).find(([, cities]) =>
    cities.includes(city),
  )?.[0];
}

function normalizedRegion(region: string, city: string): string {
  // Legacy catalog rows used the city as the region during their first seed.
  return region === city ? regionForCity(city) ?? region : region;
}

type StatusFilter = "all" | "active" | "inactive";
type CourtModalState = { mode: "create" | "edit"; court?: AdminCourtDto } | null;
type CircuitModalState = {
  mode: "create" | "edit";
  court: AdminCourtDto;
  circuit?: AdminCourtCircuitDto;
} | null;

function resultMessage(result: CourtsAdminResult<unknown>): string {
  if (result.ok) return "";
  if (result.message) return result.message;
  if (result.kind === "auth") return "يجب تسجيل الدخول أولاً";
  if (result.kind === "forbidden") return "لا تملك صلاحية إدارة المحاكم";
  if (result.kind === "network") return "تعذّر الاتصال بالخادم";
  if (result.kind === "not_found") return "السجل غير موجود";
  return "تعذّر تنفيذ العملية — حاول مرة أخرى";
}

function formatHijriDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  // Match admin mock: Hijri as yyyy/MM/dd in Riyadh (not day-first locale order).
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value.replace(/\D/g, "");
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return "—";
  return `${year}/${month}/${day}`;
}

function ActionButton({
  label,
  tone = "default",
  children,
  disabled,
  onClick,
}: {
  label: string;
  tone?: "default" | "danger" | "success";
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  const toneClass =
    tone === "danger"
      ? "text-danger-text hover:bg-danger-bg"
      : tone === "success"
        ? "text-success-text hover:bg-success-bg"
        : "text-text-2 hover:bg-surface-2 hover:text-primary";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex size-7 items-center justify-center rounded-md border-0 bg-transparent text-sm transition-colors disabled:opacity-40 ${toneClass}`}
    >
      {children}
    </button>
  );
}

function StatusToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full border-0 transition-colors ${
        checked ? "bg-success-text" : "bg-text-3"
      }`}
    >
      <span
        className={`absolute top-1 size-4 rounded-full bg-white shadow transition-[inset-inline-start] ${
          checked ? "start-6" : "start-1"
        }`}
      />
    </button>
  );
}

function CourtFormModal({
  state,
  busy,
  onClose,
  onSave,
}: {
  state: NonNullable<CourtModalState>;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: CourtDraftDto) => void;
}) {
  const initialRegion = state.court
    ? normalizedRegion(state.court.region, state.court.city)
    : Object.keys(REGION_CITIES)[0];
  const [draft, setDraft] = useState<CourtDraftDto>({
    name: state.court?.name ?? "",
    region: initialRegion,
    city: state.court?.city || REGION_CITIES[initialRegion]?.[0] || "",
    isActive: state.court?.isActive ?? true,
  });
  const regions = draft.region in REGION_CITIES
    ? Object.keys(REGION_CITIES)
    : [draft.region, ...Object.keys(REGION_CITIES)];
  const configuredCities = REGION_CITIES[draft.region] ?? [];
  const cities = configuredCities.includes(draft.city)
    ? configuredCities
    : [draft.city, ...configuredCities].filter(Boolean);
  const valid = draft.name.trim().length >= 2 && draft.region && draft.city;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard onClick={(event) => event.stopPropagation()} className="p-0">
        <ModalHeader className="border-0 bg-ink text-white">
          <span aria-hidden className="text-gold">☰</span>
          <ModalTitle className="text-start text-white">
            {state.mode === "create" ? "إضافة محكمة" : "تعديل المحكمة"}
          </ModalTitle>
          <ModalClose className="text-white/70 hover:bg-white/10 hover:text-white" onClick={onClose}>
            ×
          </ModalClose>
        </ModalHeader>
        <ModalBody className="space-y-4 p-5">
          <div>
            <Label htmlFor="court-name">اسم المحكمة <span className="text-danger-text">*</span></Label>
            <Input
              id="court-name"
              value={draft.name}
              maxLength={150}
              placeholder="مثال: المحكمة العامة بجدة"
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="court-region">المنطقة <span className="text-danger-text">*</span></Label>
              <Select
                id="court-region"
                value={draft.region}
                onChange={(event) => {
                  const region = event.target.value;
                  setDraft({
                    ...draft,
                    region,
                    city: REGION_CITIES[region]?.[0] ?? "",
                  });
                }}
              >
                {regions.map((region) => <option key={region}>{region}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="court-city">المدينة <span className="text-danger-text">*</span></Label>
              <Select
                id="court-city"
                value={draft.city}
                onChange={(event) => setDraft({ ...draft, city: event.target.value })}
              >
                {cities.map((city) => <option key={city}>{city}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-3">
            <div>
              <p className="text-xs font-bold text-text">الحالة</p>
              <p className="mt-1 text-[10px] text-text-3">
                المحاكم المعطّلة لا تظهر في قوائم الاختيار
              </p>
            </div>
            <StatusToggle
              checked={draft.isActive}
              onChange={(isActive) => setDraft({ ...draft, isActive })}
            />
          </div>
        </ModalBody>
        <ModalFooter className="justify-start">
          <Button
            variant="primary"
            loading={busy}
            disabled={!valid}
            onClick={() => onSave({ ...draft, name: draft.name.trim() })}
          >
            ✓ حفظ المحكمة
          </Button>
          <Button variant="outline" disabled={busy} onClick={onClose}>إلغاء</Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}

function CircuitFormModal({
  state,
  busy,
  onClose,
  onSave,
}: {
  state: NonNullable<CircuitModalState>;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: CourtCircuitDraftDto) => void;
}) {
  const [draft, setDraft] = useState<CourtCircuitDraftDto>({
    circuitNo: state.circuit?.circuitNo ?? "",
    circuitName: state.circuit?.circuitName ?? "",
    isActive: state.circuit?.isActive ?? true,
  });

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard onClick={(event) => event.stopPropagation()} className="p-0">
        <ModalHeader className="border-0 bg-ink text-white">
          <span aria-hidden className="text-gold">☰</span>
          <ModalTitle className="text-start text-white">
            {state.mode === "create" ? "إضافة دائرة" : "تعديل الدائرة"}
          </ModalTitle>
          <ModalClose className="text-white/70 hover:bg-white/10 hover:text-white" onClick={onClose}>
            ×
          </ModalClose>
        </ModalHeader>
        <ModalBody className="space-y-4 p-5">
          <div>
            <Label>المحكمة</Label>
            <Input value={state.court.name} readOnly className="bg-surface-2 text-text-2" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="circuit-no">رقم الدائرة <span className="text-danger-text">*</span></Label>
              <Input
                id="circuit-no"
                value={draft.circuitNo}
                maxLength={50}
                placeholder="مثال: الأولى، ١، أ"
                onChange={(event) => setDraft({ ...draft, circuitNo: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="circuit-name">اسم الدائرة</Label>
              <Input
                id="circuit-name"
                value={draft.circuitName ?? ""}
                maxLength={150}
                placeholder="اختياري"
                onChange={(event) => setDraft({ ...draft, circuitName: event.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-3">
            <div>
              <p className="text-xs font-bold text-text">الحالة</p>
              <p className="mt-1 text-[10px] text-text-3">
                الدوائر المعطّلة لا تظهر في قوائم الاختيار
              </p>
            </div>
            <StatusToggle
              checked={draft.isActive}
              onChange={(isActive) => setDraft({ ...draft, isActive })}
            />
          </div>
        </ModalBody>
        <ModalFooter className="justify-start">
          <Button
            variant="primary"
            loading={busy}
            disabled={!draft.circuitNo.trim()}
            onClick={() =>
              onSave({
                ...draft,
                circuitNo: draft.circuitNo.trim(),
                circuitName: draft.circuitName?.trim() || null,
              })
            }
          >
            ✓ حفظ الدائرة
          </Button>
          <Button variant="outline" disabled={busy} onClick={onClose}>إلغاء</Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}

export function CourtsView() {
  const { authReady, hasCapability } = usePrototype();
  const canEdit = hasCapability("courts.manage");
  const { showToast } = useToast();
  const [courts, setCourts] = useState<AdminCourtDto[]>([]);
  const [details, setDetails] = useState<Record<string, AdminCourtDetailDto>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [courtModal, setCourtModal] = useState<CourtModalState>(null);
  const [circuitModal, setCircuitModal] = useState<CircuitModalState>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadCourts = useCallback(async () => {
    if (!authReady) return;
    const config = courtsApiConfig();
    if (!config) return;
    setLoading(true);
    const result = await listAdminCourts(config, { search, status, limit: 200 });
    setLoading(false);
    if (!result.ok) {
      setLoadError(resultMessage(result));
      setCourts([]);
      return;
    }
    setLoadError("");
    setCourts(result.data.data);
  }, [authReady, search, status]);

  useEffect(() => {
    void loadCourts();
  }, [loadCourts]);

  async function loadDetail(courtId: string, force = false) {
    if (!force && details[courtId]) return;
    const config = courtsApiConfig();
    if (!config) return;
    setBusyKey(`detail:${courtId}`);
    const result = await getAdminCourt(config, courtId);
    setBusyKey(null);
    if (!result.ok) {
      showToast(resultMessage(result), "error");
      return;
    }
    setDetails((current) => ({ ...current, [courtId]: result.data }));
  }

  async function toggleExpanded(courtId: string) {
    if (expandedId === courtId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(courtId);
    await loadDetail(courtId);
  }

  async function saveCourt(draft: CourtDraftDto) {
    const config = courtsApiConfig();
    if (!config || !courtModal) return;
    setBusyKey("court-form");
    const result =
      courtModal.mode === "create"
        ? await createAdminCourt(config, draft)
        : await updateAdminCourt(config, courtModal.court!.id, draft);
    setBusyKey(null);
    if (!result.ok) {
      showToast(resultMessage(result), "error");
      return;
    }
    setCourtModal(null);
    await loadCourts();
    if (courtModal.mode === "edit") await loadDetail(result.data.id, true);
    showToast(
      courtModal.mode === "create" ? "تمت إضافة المحكمة" : "تم تحديث المحكمة",
      "success",
    );
  }

  async function saveCircuit(draft: CourtCircuitDraftDto) {
    const config = courtsApiConfig();
    if (!config || !circuitModal) return;
    const { court, circuit, mode } = circuitModal;
    setBusyKey("circuit-form");
    const result =
      mode === "create"
        ? await createAdminCourtCircuit(config, court.id, draft)
        : await updateAdminCourtCircuit(config, court.id, circuit!.id, draft);
    setBusyKey(null);
    if (!result.ok) {
      showToast(resultMessage(result), "error");
      return;
    }
    setCircuitModal(null);
    await Promise.all([loadCourts(), loadDetail(court.id, true)]);
    showToast(mode === "create" ? "تمت إضافة الدائرة" : "تم تحديث الدائرة", "success");
  }

  async function toggleCourtStatus(court: AdminCourtDto) {
    const config = courtsApiConfig();
    if (!config) return;
    setBusyKey(`court-status:${court.id}`);
    const result = await setAdminCourtStatus(config, court.id, !court.isActive);
    setBusyKey(null);
    if (!result.ok) {
      showToast(resultMessage(result), "error");
      return;
    }
    await loadCourts();
    showToast(court.isActive ? "تم تعطيل المحكمة" : "تم تفعيل المحكمة", "success");
  }

  async function toggleCircuitStatus(
    court: AdminCourtDto,
    circuit: AdminCourtCircuitDto,
  ) {
    const config = courtsApiConfig();
    if (!config) return;
    setBusyKey(`circuit-status:${circuit.id}`);
    const result = await setAdminCourtCircuitStatus(
      config,
      court.id,
      circuit.id,
      !circuit.isActive,
    );
    setBusyKey(null);
    if (!result.ok) {
      showToast(resultMessage(result), "error");
      return;
    }
    await loadDetail(court.id, true);
    showToast(circuit.isActive ? "تم تعطيل الدائرة" : "تم تفعيل الدائرة", "success");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-2" dir="rtl">
      <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-base font-bold text-heading">المحاكم والدوائر</h1>
          <p className="mt-1 text-[11px] text-text-3">
            إدارة المحاكم ودوائرها المرتبطة — تُستخدم عند تسجيل العقارات
          </p>
        </div>
        {canEdit ? (
          <Button variant="primary" onClick={() => setCourtModal({ mode: "create" })}>
            + إضافة محكمة
          </Button>
        ) : null}
      </div>

      {!canEdit && authReady ? (
        <Note tone="info" className="mx-4 mb-3 sm:mx-6">
          عرض فقط — تحتاج صلاحية إدارة المحاكم للتعديل.
        </Note>
      ) : null}

      <section className="mx-4 mb-5 overflow-hidden rounded-lg border border-border bg-surface shadow-sm sm:mx-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-bold text-heading">قائمة المحاكم</h2>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="relative min-w-[210px] flex-1 sm:flex-none">
              <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-text-3">
                ⌕
              </span>
              <Input
                aria-label="البحث في المحاكم"
                value={searchInput}
                placeholder="بحث..."
                onChange={(event) => setSearchInput(event.target.value)}
                className="pe-3 ps-8 text-xs"
              />
            </div>
            <Select
              aria-label="تصفية حسب الحالة"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
              className="w-[140px] text-xs"
            >
              <option value="all">كل الحالات</option>
              <option value="active">فعّالة</option>
              <option value="inactive">معطّلة</option>
            </Select>
          </div>
        </div>

        {loadError ? (
          <Note tone="danger" className="m-4">{loadError}</Note>
        ) : loading && courts.length === 0 ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : courts.length === 0 ? (
          <p className="py-12 text-center text-xs text-text-3">لا توجد محاكم مطابقة.</p>
        ) : (
          <Table pending={loading} className="min-w-[900px]">
            <THead>
              <Tr hoverable={false}>
                <Th className="w-8 px-2" />
                <Th>اسم المحكمة</Th>
                <Th>المنطقة / المدينة</Th>
                <Th>الدوائر</Th>
                <Th>الحالة</Th>
                <Th className="w-32 text-center">تاريخ الإضافة</Th>
                <Th className="w-32 text-center">إجراءات</Th>
              </Tr>
            </THead>
            <TBody>
              {courts.map((court) => {
                const expanded = expandedId === court.id;
                const detail = details[court.id];
                return (
                  <CourtRows
                    key={court.id}
                    court={court}
                    detail={detail}
                    expanded={expanded}
                    canEdit={canEdit}
                    busyKey={busyKey}
                    onToggle={() => void toggleExpanded(court.id)}
                    onEditCourt={() => setCourtModal({ mode: "edit", court })}
                    onAddCircuit={() => setCircuitModal({ mode: "create", court })}
                    onToggleCourtStatus={() => void toggleCourtStatus(court)}
                    onEditCircuit={(circuit) =>
                      setCircuitModal({ mode: "edit", court, circuit })
                    }
                    onToggleCircuitStatus={(circuit) =>
                      void toggleCircuitStatus(court, circuit)
                    }
                  />
                );
              })}
            </TBody>
          </Table>
        )}
      </section>

      {courtModal ? (
        <CourtFormModal
          key={`${courtModal.mode}:${courtModal.court?.id ?? "new"}`}
          state={courtModal}
          busy={busyKey === "court-form"}
          onClose={() => setCourtModal(null)}
          onSave={(draft) => void saveCourt(draft)}
        />
      ) : null}
      {circuitModal ? (
        <CircuitFormModal
          key={`${circuitModal.mode}:${circuitModal.circuit?.id ?? "new"}`}
          state={circuitModal}
          busy={busyKey === "circuit-form"}
          onClose={() => setCircuitModal(null)}
          onSave={(draft) => void saveCircuit(draft)}
        />
      ) : null}
    </div>
  );
}

function CourtRows({
  court,
  detail,
  expanded,
  canEdit,
  busyKey,
  onToggle,
  onEditCourt,
  onAddCircuit,
  onToggleCourtStatus,
  onEditCircuit,
  onToggleCircuitStatus,
}: {
  court: AdminCourtDto;
  detail?: AdminCourtDetailDto;
  expanded: boolean;
  canEdit: boolean;
  busyKey: string | null;
  onToggle: () => void;
  onEditCourt: () => void;
  onAddCircuit: () => void;
  onToggleCourtStatus: () => void;
  onEditCircuit: (circuit: AdminCourtCircuitDto) => void;
  onToggleCircuitStatus: (circuit: AdminCourtCircuitDto) => void;
}) {
  return (
    <>
      <Tr hoverable={false} className="hover:bg-row-hover">
        <Td className="px-2">
          <button
            type="button"
            aria-label={expanded ? "طي الدوائر" : "عرض الدوائر"}
            aria-expanded={expanded}
            onClick={onToggle}
            className="inline-flex size-7 items-center justify-center rounded-md bg-transparent text-text-2"
          >
            <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>‹</span>
          </button>
        </Td>
        <Td className="font-bold text-heading">{court.name}</Td>
        <Td>
          <span>{normalizedRegion(court.region, court.city)}</span>
          <span className="text-text-3"> — {court.city}</span>
        </Td>
        <Td>
          <Badge tone="info">● {court.circuitsCount} دائرة</Badge>
        </Td>
        <Td>
          <Badge tone={court.isActive ? "success" : "danger"} dot>
            {court.isActive ? "فعّالة" : "معطّلة"}
          </Badge>
        </Td>
        <Td className="w-32 text-center text-text-2">
          <span dir="ltr" className="inline-block tabular-nums">
            {formatHijriDate(court.createdAtUtc)}
          </span>
        </Td>
        <Td className="w-32">
          {canEdit ? (
            <div className="flex items-center justify-center gap-1">
              <ActionButton label="إضافة دائرة" disabled={Boolean(busyKey)} onClick={onAddCircuit}>＋</ActionButton>
              <ActionButton label="تعديل المحكمة" disabled={Boolean(busyKey)} onClick={onEditCourt}>✎</ActionButton>
              <ActionButton
                label={court.isActive ? "تعطيل المحكمة" : "تفعيل المحكمة"}
                tone={court.isActive ? "danger" : "success"}
                disabled={Boolean(busyKey)}
                onClick={onToggleCourtStatus}
              >
                {court.isActive ? "⊘" : "✓"}
              </ActionButton>
            </div>
          ) : (
            <span className="text-text-3">—</span>
          )}
        </Td>
      </Tr>
      {expanded ? (
        <Tr hoverable={false}>
          <Td colSpan={7} className="bg-surface-2 p-0">
            {busyKey === `detail:${court.id}` && !detail ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : !detail || detail.circuits.length === 0 ? (
              <p className="py-5 text-center text-xs text-text-3">لا توجد دوائر لهذه المحكمة.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-[11px] text-text-3">
                    <th className="px-12 py-2 text-start font-semibold">رقم الدائرة</th>
                    <th className="px-4 py-2 text-start font-semibold">اسم الدائرة</th>
                    <th className="px-4 py-2 text-start font-semibold">الحالة</th>
                    <th className="px-4 py-2 text-center font-semibold">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.circuits.map((circuit) => (
                    <tr key={circuit.id} className="border-t border-border bg-surface/70 text-xs">
                      <td className="px-12 py-2.5 font-bold text-heading">{circuit.circuitNo}</td>
                      <td className="px-4 py-2.5 text-text-2">{circuit.circuitName || "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={circuit.isActive ? "success" : "danger"} dot>
                          {circuit.isActive ? "فعّالة" : "معطّلة"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {canEdit ? (
                          <div className="flex justify-center gap-1">
                            <ActionButton
                              label="تعديل الدائرة"
                              disabled={Boolean(busyKey)}
                              onClick={() => onEditCircuit(circuit)}
                            >
                              ✎
                            </ActionButton>
                            <ActionButton
                              label={circuit.isActive ? "تعطيل الدائرة" : "تفعيل الدائرة"}
                              tone={circuit.isActive ? "danger" : "success"}
                              disabled={Boolean(busyKey)}
                              onClick={() => onToggleCircuitStatus(circuit)}
                            >
                              {circuit.isActive ? "⊘" : "✓"}
                            </ActionButton>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Td>
        </Tr>
      ) : null}
    </>
  );
}
