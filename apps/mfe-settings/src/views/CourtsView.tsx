"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import {
  createAdminCourt,
  createAdminCourtCircuit,
  getAdminCourt,
  listAdminCourts,
  setAdminCourtCircuitStatus,
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
  Card,
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
  useToast,
} from "@platform/ui-kit";
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
  return region === city ? regionForCity(city) ?? region : region;
}

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
    : Object.keys(REGION_CITIES)[0]!;
  const [draft, setDraft] = useState<CourtDraftDto>({
    name: state.court?.name ?? "",
    region: initialRegion,
    city: state.court?.city || REGION_CITIES[initialRegion]?.[0] || "",
    isActive: state.court?.isActive ?? true,
  });
  const regions =
    draft.region in REGION_CITIES
      ? Object.keys(REGION_CITIES)
      : [draft.region, ...Object.keys(REGION_CITIES)];
  const configuredCities = REGION_CITIES[draft.region] ?? [];
  const cities = configuredCities.includes(draft.city)
    ? configuredCities
    : [draft.city, ...configuredCities].filter(Boolean);
  const valid = draft.name.trim().length >= 2 && draft.region && draft.city;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <ModalHeader>
          <ModalTitle>
            {state.mode === "create" ? "إضافة محكمة" : "تعديل المحكمة"}
          </ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-3.5">
          <div>
            <Label htmlFor="court-name">اسم المحكمة</Label>
            <Input
              id="court-name"
              value={draft.name}
              maxLength={150}
              placeholder="مثال: المحكمة العامة بجدة"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="court-region">المنطقة</Label>
              <Select
                id="court-region"
                value={draft.region}
                onChange={(e) => {
                  const region = e.target.value;
                  setDraft({
                    ...draft,
                    region,
                    city: REGION_CITIES[region]?.[0] ?? "",
                  });
                }}
              >
                {regions.map((region) => (
                  <option key={region}>{region}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="court-city">المدينة</Label>
              <Select
                id="court-city"
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              >
                {cities.map((city) => (
                  <option key={city}>{city}</option>
                ))}
              </Select>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!valid}
            onClick={() => onSave({ ...draft, name: draft.name.trim() })}
          >
            حفظ
          </Button>
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
      <ModalCard onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <ModalHeader>
          <ModalTitle>
            {state.mode === "create" ? "إضافة دائرة" : "تعديل الدائرة"}
          </ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-3.5">
          <p className="m-0 text-[12.5px] text-text-2">{state.court.name}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="circuit-no">رقم الدائرة</Label>
              <Input
                id="circuit-no"
                value={draft.circuitNo}
                maxLength={50}
                placeholder="مثال: الأولى"
                onChange={(e) => setDraft({ ...draft, circuitNo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="circuit-name">اسم الدائرة</Label>
              <Input
                id="circuit-name"
                value={draft.circuitName ?? ""}
                maxLength={150}
                placeholder="اختياري"
                onChange={(e) => setDraft({ ...draft, circuitName: e.target.value })}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            إلغاء
          </Button>
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
            حفظ
          </Button>
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
  const [names, setNames] = useState<Record<string, string>>({});
  const [circuitsCourt, setCircuitsCourt] = useState<AdminCourtDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [courtModal, setCourtModal] = useState<CourtModalState>(null);
  const [circuitModal, setCircuitModal] = useState<CircuitModalState>(null);

  const loadCourts = useCallback(async () => {
    if (!authReady) return;
    const config = courtsApiConfig();
    if (!config) return;
    setLoading(true);
    const result = await listAdminCourts(config, { search: "", status: "all", limit: 200 });
    setLoading(false);
    if (!result.ok) {
      setLoadError(resultMessage(result));
      setCourts([]);
      return;
    }
    setLoadError("");
    setCourts(result.data.data);
    setNames(Object.fromEntries(result.data.data.map((c) => [c.id, c.name])));
  }, [authReady]);

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

  async function openCircuits(court: AdminCourtDto) {
    setCircuitsCourt(court);
    await loadDetail(court.id);
  }

  async function persistName(court: AdminCourtDto) {
    const next = (names[court.id] ?? court.name).trim();
    if (next.length < 2 || next === court.name) {
      setNames((n) => ({ ...n, [court.id]: court.name }));
      return;
    }
    const config = courtsApiConfig();
    if (!config) return;
    setBusyKey(`name:${court.id}`);
    const result = await updateAdminCourt(config, court.id, {
      name: next,
      region: court.region,
      city: court.city,
      isActive: court.isActive,
    });
    setBusyKey(null);
    if (!result.ok) {
      showToast(resultMessage(result), "error");
      setNames((n) => ({ ...n, [court.id]: court.name }));
      return;
    }
    await loadCourts();
    showToast("تم تحديث المحكمة", "success");
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
    showToast(courtModal.mode === "create" ? "تمت إضافة المحكمة" : "تم تحديث المحكمة", "success");
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

  async function toggleCircuitStatus(court: AdminCourtDto, circuit: AdminCourtCircuitDto) {
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

  const circuitsDetail = circuitsCourt ? details[circuitsCourt.id] : undefined;

  return (
    <PageShell variant="canvas" className="gap-0 px-4 pb-4 pt-2 sm:px-6 sm:pb-6" dir="rtl">
      {!canEdit && authReady ? (
        <Note tone="warn" className="mb-3 max-w-[560px]">
          الرابط صحيح، لكن دورك الحالي لا يملك صلاحية هذا البند. اطلب الصلاحية من مسؤول النظام.
        </Note>
      ) : null}
      {loadError ? <Note tone="warn">{loadError}</Note> : null}

      {canEdit ? (
        <div className="mb-3 flex flex-wrap gap-2.5">
          <Button variant="default" onClick={() => setCourtModal({ mode: "create" })}>
            إضافة محكمة
          </Button>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {loading && courts.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-text-3">
            <Spinner />
            <span className="text-[13px]">جاري التحميل…</span>
          </div>
        ) : (
          <Table className="tabular-nums">
            <THead>
              <Tr hoverable={false}>
                <Th>المحكمة</Th>
                <Th>المدينة</Th>
                <Th>الدوائر</Th>
                <Th>الاستخدام</Th>
                <Th>الحالة</Th>
              </Tr>
            </THead>
            <TBody>
              {courts.length === 0 ? (
                <Tr hoverable={false}>
                  <Td colSpan={5} className="py-10 text-center text-[12.5px] text-text-3">
                    لا توجد محاكم بعد
                  </Td>
                </Tr>
              ) : (
                courts.map((court) => (
                  <Tr key={court.id} hoverable={false}>
                    <Td className="min-w-[220px]">
                      {canEdit ? (
                        <input
                          value={names[court.id] ?? court.name}
                          disabled={busyKey === `name:${court.id}`}
                          onChange={(e) =>
                            setNames((n) => ({ ...n, [court.id]: e.target.value }))
                          }
                          onBlur={() => void persistName(court)}
                          className="w-full border-0 border-b border-transparent bg-transparent p-0.5 font-[inherit] text-[13px] font-medium text-text outline-none focus:border-gold"
                        />
                      ) : (
                        <span className="font-medium">{court.name}</span>
                      )}
                    </Td>
                    <Td>{court.city}</Td>
                    <Td>
                      <button
                        type="button"
                        className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[13px] text-ink hover:text-gold-d"
                        onClick={() => void openCircuits(court)}
                      >
                        {court.circuitsCount}
                      </button>
                    </Td>
                    <Td>
                      <bdi>—</bdi>
                    </Td>
                    <Td>
                      <Badge tone={court.isActive ? "success" : "default"}>
                        {court.isActive ? "ساري" : "معطّل"}
                      </Badge>
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
        )}
      </Card>
      <p className="mx-0.5 mt-2.5 text-[11.5px] text-text-3">
        مرجع رسمي — إضافة فقط، والدمج والتصحيح عبر وحدة المواقع.
      </p>

      {circuitsCourt ? (
        <ModalOverlay onClick={() => setCircuitsCourt(null)}>
          <ModalCard
            className="w-full max-w-[640px]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
          >
            <ModalHeader>
              <ModalTitle>دوائر {circuitsCourt.name}</ModalTitle>
            </ModalHeader>
            <ModalBody>
              {canEdit ? (
                <div className="mb-3">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() =>
                      setCircuitModal({ mode: "create", court: circuitsCourt })
                    }
                  >
                    إضافة دائرة
                  </Button>
                </div>
              ) : null}
              {busyKey === `detail:${circuitsCourt.id}` && !circuitsDetail ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : !circuitsDetail || circuitsDetail.circuits.length === 0 ? (
                <p className="m-0 py-6 text-center text-[12.5px] text-text-3">
                  لا توجد دوائر لهذه المحكمة.
                </p>
              ) : (
                <Table className="tabular-nums">
                  <THead>
                    <Tr hoverable={false}>
                      <Th>رقم الدائرة</Th>
                      <Th>اسم الدائرة</Th>
                      <Th>الحالة</Th>
                      <Th />
                    </Tr>
                  </THead>
                  <TBody>
                    {circuitsDetail.circuits.map((circuit) => (
                      <Tr key={circuit.id} hoverable={false}>
                        <Td className="font-medium">{circuit.circuitNo}</Td>
                        <Td>{circuit.circuitName || "—"}</Td>
                        <Td>
                          <Badge tone={circuit.isActive ? "success" : "default"}>
                            {circuit.isActive ? "ساري" : "معطّل"}
                          </Badge>
                        </Td>
                        <Td className="whitespace-nowrap">
                          {canEdit ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setCircuitModal({
                                    mode: "edit",
                                    court: circuitsCourt,
                                    circuit,
                                  })
                                }
                              >
                                تعديل
                              </Button>{" "}
                              <Button
                                variant="ghost"
                                size="sm"
                                loading={busyKey === `circuit-status:${circuit.id}`}
                                onClick={() =>
                                  void toggleCircuitStatus(circuitsCourt, circuit)
                                }
                              >
                                {circuit.isActive ? "تعطيل" : "تفعيل"}
                              </Button>
                            </>
                          ) : null}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setCircuitsCourt(null)}>
                إغلاق
              </Button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}

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
    </PageShell>
  );
}
