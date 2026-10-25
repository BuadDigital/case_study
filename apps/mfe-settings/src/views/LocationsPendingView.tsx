"use client";


import { useCallback, useEffect, useState, type ChangeEvent } from "react";
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
  MobileRecordCard,
  MobileRecordList,
  OpsIcon,
  PageLoadingHint,
  PageShell,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from "@platform/ui-kit";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import {
  opsBtnSm,
  opsBtnSmPrimary,
  opsFldControl,
  opsIconBoxGold,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsCountBadge,
  opsTfNote,
} from "@platform/ui-kit";

const MAP_PIN_ICON =
  "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";


function kindLabel(kind: string): string {
  return kind === "district" ? "حي" : "مدينة";
}

function KindBadge({ kind }: { kind: string }) {
  return <Badge tone={kind === "district" ? "info" : "primary"}>{kindLabel(kind)}</Badge>;
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
    const config = apiConfig();
    if (!config) return;
    setLoading(true);
    const result = await listPendingLocations(config);
    setLoading(false);
    if (!result.ok) {
      setItems([]);
      setLoadError(
        result.kind === "auth"
          ? "يلزم تسجيل الدخول"
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
    const config = apiConfig();
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

  /** The rename draft input wiring (table cell and phone card). */
  function renameInputProps(item: PendingLocationDto) {
    return {
      value: renameDrafts[item.id] ?? item.nameAr,
      onChange: (e: ChangeEvent<HTMLInputElement>) =>
        setRenameDrafts((prev) => ({
          ...prev,
          [item.id]: e.target.value,
        })),
    };
  }

  /** Approve / rename-and-approve (table cell and phone card). */
  function reviewActions(item: PendingLocationDto) {
    return (
      <>
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
      </>
    );
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
          <span className={opsCountBadge}>
            <bdi dir="ltr" className="tabular-nums">{items.length}</bdi>
            {/* Phones stretch the badge into a full-width bar — a bare number reads as noise. */}
            <span className="ms-1 lg:hidden">موقع</span>
          </span>
        </div>

        {loadError ? (
          <p className="m-0 px-4 py-4 text-[12.5px] text-[#d9694f] sm:px-[18px]">
            {loadError}
          </p>
        ) : null}
        {loading ? (
          <PageLoadingHint />
        ) : items.length === 0 && !loadError ? (
          <EmptyState line="لا توجد مسميات بانتظار المراجعة." />
        ) : !loading && !loadError ? (
          <>
          {/* Phones: one card per pending name — the 720px table scrolled sideways. */}
          <MobileRecordList className="px-4 py-3 lg:hidden" isEmpty={false}>
            {items.map((item) => (
              <MobileRecordCard
                key={`${item.kind}-${item.id}`}
                title={item.nameAr}
                subtitle={
                  item.rawInput && item.rawInput !== item.nameAr
                    ? `المدخل: ${item.rawInput}`
                    : undefined
                }
                status={<KindBadge kind={item.kind} />}
                fields={[
                  { label: "النطاق", value: item.scopeLabel || "—" },
                  { label: "الاستخدام", value: item.usageCount, ltr: true },
                ]}
                actions={reviewActions(item)}
              >
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-[11.5px] font-medium text-text-3">تصحيح الاسم</span>
                  <input
                    className={cn(opsFldControl, "min-h-11 w-full text-[14px]")}
                    {...renameInputProps(item)}
                  />
                </label>
              </MobileRecordCard>
            ))}
          </MobileRecordList>
          <Table className="min-w-[720px] tabular-nums" wrapClassName="max-lg:hidden">
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
                      <KindBadge kind={item.kind} />
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
                        {...renameInputProps(item)}
                      />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {reviewActions(item)}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </>
        ) : null}
      </section>
    </PageShell>
  );
}
