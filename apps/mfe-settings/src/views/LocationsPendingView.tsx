"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import {
  listPendingLocations,
  reviewPendingCity,
  reviewPendingDistrict,
  type PendingLocationDto,
} from "@platform/api-client";
import {
  Badge,
  cn,
  EmptyState,
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
import { regionsApiConfig } from "../lib/settings-api-config";
import {
  opsBtnSm,
  opsBtnSmPrimary,
  opsFldControl,
  opsIconBoxGold,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsPpBadge,
  opsTfNote,
} from "../lib/settings-ops-tw";

const MAP_PIN_ICON =
  "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";

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

function kindLabel(kind: string): string {
  return kind === "district" ? "حي" : "مدينة";
}

export function LocationsPendingView() {
  const { authReady } = useAppAccess();
  const { showToast } = useToast();
  const [items, setItems] = useState<PendingLocationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    if (!authReady) return;
    const config = regionsApiConfig();
    if (!config) return;
    setLoading(true);
    const result = await listPendingLocations(config);
    setLoading(false);
    if (!result.ok) {
      setItems([]);
      setLoadError(
        result.kind === "auth"
          ? "يجب تسجيل الدخول"
          : result.kind === "forbidden"
            ? "لا تملك صلاحية مراجعة المسميات"
            : "تعذّر تحميل طابور المراجعة",
      );
      return;
    }
    setLoadError("");
    setItems(result.items);
  }, [authReady]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(
    item: PendingLocationDto,
    action: "approve" | "rename",
  ) {
    const config = regionsApiConfig();
    if (!config) return;
    setBusyId(item.id);
    const nameAr =
      action === "rename"
        ? (renameDrafts[item.id] ?? item.nameAr).trim()
        : undefined;
    const result =
      item.kind === "district"
        ? await reviewPendingDistrict(config, item.id, { action, nameAr })
        : await reviewPendingCity(config, item.id, { action, nameAr });
    setBusyId(null);
    if (!result.ok) {
      showToast(
        result.message ??
          (result.kind === "forbidden"
            ? "لا تملك صلاحية المراجعة"
            : "تعذّر تنفيذ المراجعة"),
        "error",
      );
      return;
    }
    showToast(action === "rename" ? "تم الاعتماد بالاسم الجديد" : "تم الاعتماد");
    await load();
  }

  return (
    <PageShell
      variant="canvas"
      className="gap-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
      dir="rtl"
    >
      <p className={cn(opsTfNote, "m-0 mb-3.5")}>
        مدن وأحياء أضافها المستخدمون — اعتمد أو صحّح الاسم قبل دمجه لاحقاً في
        المرجع الرسمي.
      </p>

      <section className={opsLetterCard}>
        <div className={opsLetterHead}>
          <div className="flex items-center gap-[11px]">
            <span className={opsIconBoxGold}>
              <OpsIcon path={MAP_PIN_ICON} />
            </span>
            <div>
              <div className={opsLetterTitle}>مراجعة المسميات المبدئية</div>
              <div className={opsLetterSub}>
                طابور الاعتماد للمدن والأحياء المقترحة
              </div>
            </div>
          </div>
          <span className={opsPpBadge}>{items.length}</span>
        </div>

        {loadError ? (
          <p className="m-0 px-4 py-4 text-[12.5px] text-[#d9694f] sm:px-[18px]">
            {loadError}
          </p>
        ) : null}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-text-3">
            <Spinner />
            <span className="text-[13px]">جاري التحميل…</span>
          </div>
        ) : items.length === 0 && !loadError ? (
          <EmptyState line="لا توجد مسميات بانتظار المراجعة." />
        ) : !loading && !loadError ? (
          <Table className="min-w-[720px] tabular-nums">
            <THead>
                <Tr hoverable={false}>
                  <Th>النوع</Th>
                  <Th>الاسم</Th>
                  <Th>النطاق</Th>
                  <Th>الاستخدام</Th>
                  <Th>تصحيح الاسم</Th>
                  <Th>إجراءات</Th>
                </Tr>
              </THead>
              <TBody>
                {items.map((item) => (
                  <Tr key={`${item.kind}-${item.id}`} hoverable={false}>
                    <Td>
                      <Badge
                        tone={item.kind === "district" ? "info" : "primary"}
                      >
                        {kindLabel(item.kind)}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="font-semibold text-heading">
                        {item.nameAr}
                      </div>
                      {item.rawInput && item.rawInput !== item.nameAr ? (
                        <div className="text-[10px] text-text-3">
                          المدخل: {item.rawInput}
                        </div>
                      ) : null}
                    </Td>
                    <Td>{item.scopeLabel || "—"}</Td>
                    <Td>{item.usageCount}</Td>
                    <Td>
                      <input
                        className={cn(opsFldControl, "min-w-[140px] text-xs")}
                        value={renameDrafts[item.id] ?? item.nameAr}
                        onChange={(e) =>
                          setRenameDrafts((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          className={opsBtnSmPrimary}
                          disabled={busyId === item.id}
                          onClick={() => void review(item, "approve")}
                        >
                          {busyId === item.id ? "…" : "اعتماد"}
                        </button>
                        <button
                          type="button"
                          className={opsBtnSm}
                          disabled={busyId === item.id}
                          onClick={() => void review(item, "rename")}
                        >
                          تصحيح واعتماد
                        </button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
        ) : null}
      </section>
    </PageShell>
  );
}
