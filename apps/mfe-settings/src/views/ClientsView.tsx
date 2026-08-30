"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createClient,
  deactivateClient,
  INFATH_SEED_CLIENT_ID,
  NABR_SEED_CLIENT_ID,
  listClients,
  updateClient,
  type ClientDto,
  type UpsertClientRequest,
} from "@platform/api-client";
import { Can, useCapability } from "@platform/app-shared/components/Can";
import {
  Badge,
  cn,
  EmptyState,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  PageShell,
  Spinner,
  Table,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
  useToast,
} from "@platform/ui-kit";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";
import {
  opsBtnGhost,
  opsBtnPrimary,
  opsBtnSm,
  opsBtnSmPrimary,
  opsFld,
  opsFldControl,
  opsFldFull,
  opsFilters,
  opsFormGrid,
  opsIconBoxGold,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsPpBadge,
  opsTfLbl,
  opsTfNote,
} from "../lib/settings-ops-tw";

type Draft = UpsertClientRequest & { id?: string };

const USERS_ICON =
  "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75";
const PLUS_ICON = "M12 5v14M5 12h14";

function OpsIcon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

function emptyDraft(): Draft {
  return {
    nameAr: "",
    nameEn: "",
    identityNumber: "",
    phone: "",
    email: "",
    isActive: true,
  };
}

function toDraft(row: ClientDto): Draft {
  return {
    id: row.id,
    nameAr: row.nameAr,
    nameEn: row.nameEn ?? "",
    identityNumber: row.identityNumber ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    isActive: row.isActive,
  };
}

export function ClientsView() {
  const { showToast } = useToast();
  const canEdit = useCapability("manage-work-orders");
  const [rows, setRows] = useState<ClientDto[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const config = organizationSettingsApiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    setLoading(true);
    const res = await listClients(config, includeInactive);
    setLoading(false);
    if (!res.ok) {
      setError(
        res.kind === "auth"
          ? "يلزم تسجيل الدخول"
          : res.kind === "forbidden"
            ? "لا تملك صلاحية عرض العملاء"
            : "تعذّر تحميل سجل العملاء",
      );
      return;
    }
    setError(null);
    setRows(res.data);
  }, [includeInactive]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar")),
    [rows],
  );

  async function persist() {
    if (!modal) return;
    const config = organizationSettingsApiConfig();
    if (!config) return;
    const nameAr = modal.nameAr.trim();
    if (!nameAr) {
      showToast("اسم العميل بالعربية مطلوب", "error");
      return;
    }
    setSaving(true);
    const body: UpsertClientRequest = {
      nameAr,
      nameEn: modal.nameEn?.trim() || null,
      identityNumber: modal.identityNumber?.trim() || null,
      phone: modal.phone?.trim() || null,
      email: modal.email?.trim() || null,
      isActive: modal.isActive !== false,
    };
    const res = modal.id
      ? await updateClient(config, modal.id, body)
      : await createClient(config, body);
    setSaving(false);
    if (!res.ok) {
      showToast(
        res.errors?.nameAr ?? res.message ?? "تعذّر حفظ العميل",
        "error",
      );
      return;
    }
    setModal(null);
    showToast(modal.id ? "تم تحديث العميل" : "تم إضافة العميل", "success");
    await reload();
  }

  async function onDeactivate(row: ClientDto) {
    if (row.id === INFATH_SEED_CLIENT_ID) {
      showToast("لا يمكن تعطيل عميل إنفاذ الأساسي", "error");
      return;
    }
    if (row.id === NABR_SEED_CLIENT_ID) {
      showToast("لا يمكن تعطيل شركة نبر العقارية", "error");
      return;
    }
    if (!window.confirm(`تعطيل العميل «${row.nameAr}»؟`)) return;
    const config = organizationSettingsApiConfig();
    if (!config) return;
    const res = await deactivateClient(config, row.id);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر تعطيل العميل", "error");
      return;
    }
    showToast("تم تعطيل العميل", "success");
    await reload();
  }

  return (
    <PageShell
      variant="canvas"
      className="gap-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
      dir="rtl"
    >
      <p className={cn(opsTfNote, "m-0 mb-3.5")}>
        العميل إلزامي عند فتح أمر عمل — ليس حساب دخول للنظام.
      </p>

      <section className={opsLetterCard}>
        <div className={opsLetterHead}>
          <div className="flex items-center gap-[11px]">
            <span className={opsIconBoxGold}>
              <OpsIcon path={USERS_ICON} />
            </span>
            <div>
              <div className={opsLetterTitle}>سجل العملاء</div>
              <div className={opsLetterSub}>
                جهات الطلب الرسمية المرتبطة بأوامر العمل
              </div>
            </div>
          </div>
          <div className={cn(opsFilters, "justify-end")}>
            <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-text-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-gold-d"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              إظهار المعطّلين
            </label>
            <Can capability="manage-work-orders">
              <button
                type="button"
                className={opsBtnPrimary}
                onClick={() => setModal(emptyDraft())}
              >
                <OpsIcon path={PLUS_ICON} size={16} />
                إضافة عميل
              </button>
            </Can>
            <span className={opsPpBadge}>{sorted.length}</span>
          </div>
        </div>

        {error ? (
          <p className="m-0 px-4 py-4 text-[12.5px] text-[#d9694f] sm:px-[18px]">
            {error}
          </p>
        ) : null}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-text-3">
            <Spinner />
            <span className="text-[13px]">جاري التحميل…</span>
          </div>
        ) : sorted.length === 0 && !error ? (
          <EmptyState line="لا يوجد عملاء بعد." />
        ) : !loading && !error ? (
          <Table className="min-w-[720px] tabular-nums">
            <THead>
                <Tr hoverable={false}>
                  <Th>الاسم</Th>
                  <Th>الهوية / السجل</Th>
                  <Th>الهاتف</Th>
                  <Th>الحالة</Th>
                  <Th />
                </Tr>
              </THead>
              <TBody>
                {sorted.map((row) => (
                  <Tr key={row.id} hoverable={false}>
                    <Td>
                      <div className="font-semibold text-heading">{row.nameAr}</div>
                      {row.nameEn ? (
                        <div className="text-[11px] text-text-3" dir="ltr">
                          {row.nameEn}
                        </div>
                      ) : null}
                      {row.id === INFATH_SEED_CLIENT_ID ? (
                        <Badge className="mt-1" tone="info">
                          إنفاذ (بذرة)
                        </Badge>
                      ) : row.id === NABR_SEED_CLIENT_ID ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge tone="info">نبر (بذرة)</Badge>
                          <Badge tone="info">فرعي لإنفاذ</Badge>
                        </div>
                      ) : null}
                    </Td>
                    <TdLtr bare>{row.identityNumber || "—"}</TdLtr>
                    <TdLtr bare>{row.phone || "—"}</TdLtr>
                    <Td>
                      <Badge tone={row.isActive ? "success" : "default"}>
                        {row.isActive ? "نشط" : "معطّل"}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {canEdit ? (
                          <button
                            type="button"
                            className={opsBtnSmPrimary}
                            onClick={() => setModal(toDraft(row))}
                          >
                            تعديل
                          </button>
                        ) : null}
                        {canEdit &&
                        row.isActive &&
                        row.id !== INFATH_SEED_CLIENT_ID &&
                        row.id !== NABR_SEED_CLIENT_ID ? (
                          <button
                            type="button"
                            className={opsBtnSm}
                            onClick={() => void onDeactivate(row)}
                          >
                            تعطيل
                          </button>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
        ) : null}
      </section>

      {modal ? (
        <ModalOverlay onClick={() => !saving && setModal(null)}>
          <ModalCard wide onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{modal.id ? "تعديل عميل" : "إضافة عميل"}</ModalTitle>
              <ModalClose onClick={() => !saving && setModal(null)}>×</ModalClose>
            </ModalHeader>
            <ModalBody>
              <div className={opsFormGrid}>
                <div className={opsFldFull}>
                  <label htmlFor="client-name-ar" className={opsTfLbl}>
                    الاسم بالعربية *
                  </label>
                  <input
                    id="client-name-ar"
                    className={opsFldControl}
                    value={modal.nameAr}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setModal((d) => (d ? { ...d, nameAr: e.target.value } : d))
                    }
                  />
                </div>
                <div className={opsFldFull}>
                  <label htmlFor="client-name-en" className={opsTfLbl}>
                    الاسم بالإنجليزية
                  </label>
                  <input
                    id="client-name-en"
                    className={opsFldControl}
                    dir="ltr"
                    value={modal.nameEn ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setModal((d) => (d ? { ...d, nameEn: e.target.value } : d))
                    }
                  />
                </div>
                <div className={opsFld}>
                  <label htmlFor="client-id-no" className={opsTfLbl}>
                    هوية / سجل تجاري
                  </label>
                  <input
                    id="client-id-no"
                    className={opsFldControl}
                    dir="ltr"
                    value={modal.identityNumber ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setModal((d) =>
                        d ? { ...d, identityNumber: e.target.value } : d,
                      )
                    }
                  />
                </div>
                <div className={opsFld}>
                  <label htmlFor="client-phone" className={opsTfLbl}>
                    الهاتف
                  </label>
                  <input
                    id="client-phone"
                    className={opsFldControl}
                    dir="ltr"
                    value={modal.phone ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setModal((d) => (d ? { ...d, phone: e.target.value } : d))
                    }
                  />
                </div>
                <div className={opsFldFull}>
                  <label htmlFor="client-email" className={opsTfLbl}>
                    البريد
                  </label>
                  <input
                    id="client-email"
                    type="email"
                    className={opsFldControl}
                    dir="ltr"
                    value={modal.email ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setModal((d) => (d ? { ...d, email: e.target.value } : d))
                    }
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <button
                type="button"
                className={opsBtnGhost}
                disabled={saving}
                onClick={() => setModal(null)}
              >
                إلغاء
              </button>
              {canEdit ? (
                <button
                  type="button"
                  className={opsBtnPrimary}
                  disabled={saving}
                  onClick={() => void persist()}
                >
                  {saving ? "جاري الحفظ…" : "حفظ"}
                </button>
              ) : null}
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </PageShell>
  );
}
