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
  PageShell,
  Spinner,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from "@platform/ui-kit";
import { organizationSettingsApiConfig } from "../lib/settings-api-config";

type Draft = UpsertClientRequest & { id?: string };

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
    <PageShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-lg font-bold text-text">سجل العملاء</h1>
          <p className="m-0 mt-1 text-xs text-text-2">
            العميل إلزامي عند فتح أمر عمل — ليس حساب دخول.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-text-2">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            إظهار المعطّلين
          </label>
          <Can capability="manage-work-orders">
            <Button type="button" variant="primary" onClick={() => setModal(emptyDraft())}>
              إضافة عميل
            </Button>
          </Can>
        </div>
      </div>

      {error ? <Note tone="warn">{error}</Note> : null}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>الاسم</Th>
              <Th>الهوية / السجل</Th>
              <Th>الهاتف</Th>
              <Th>الحالة</Th>
              <Th />
            </Tr>
          </THead>
          <TBody>
            {sorted.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <div className="font-semibold text-text">{row.nameAr}</div>
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
                <Td dir="ltr">{row.identityNumber || "—"}</Td>
                <Td dir="ltr">{row.phone || "—"}</Td>
                <Td>
                  <Badge tone={row.isActive ? "success" : "default"}>
                    {row.isActive ? "نشط" : "معطّل"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    {canEdit ? (
                      <Button type="button" size="sm" onClick={() => setModal(toDraft(row))}>
                        تعديل
                      </Button>
                    ) : null}
                    {canEdit &&
                    row.isActive &&
                    row.id !== INFATH_SEED_CLIENT_ID &&
                    row.id !== NABR_SEED_CLIENT_ID ? (
                      <Button type="button" size="sm" onClick={() => void onDeactivate(row)}>
                        تعطيل
                      </Button>
                    ) : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      {modal ? (
        <ModalOverlay onClick={() => !saving && setModal(null)}>
          <ModalCard wide onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{modal.id ? "تعديل عميل" : "إضافة عميل"}</ModalTitle>
              <ModalClose onClick={() => !saving && setModal(null)}>×</ModalClose>
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="client-name-ar">الاسم بالعربية *</Label>
                  <Input
                    id="client-name-ar"
                    value={modal.nameAr}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setModal((d) => (d ? { ...d, nameAr: e.target.value } : d))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="client-name-en">الاسم بالإنجليزية</Label>
                  <Input
                    id="client-name-en"
                    dir="ltr"
                    value={modal.nameEn ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setModal((d) => (d ? { ...d, nameEn: e.target.value } : d))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="client-id-no">هوية / سجل تجاري</Label>
                  <Input
                    id="client-id-no"
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
                <div>
                  <Label htmlFor="client-phone">الهاتف</Label>
                  <Input
                    id="client-phone"
                    dir="ltr"
                    value={modal.phone ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setModal((d) => (d ? { ...d, phone: e.target.value } : d))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="client-email">البريد</Label>
                  <Input
                    id="client-email"
                    type="email"
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
              <Button type="button" disabled={saving} onClick={() => setModal(null)}>
                إلغاء
              </Button>
              {canEdit ? (
                <Button
                  type="button"
                  variant="primary"
                  loading={saving}
                  onClick={() => void persist()}
                >
                  حفظ
                </Button>
              ) : null}
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </PageShell>
  );
}
