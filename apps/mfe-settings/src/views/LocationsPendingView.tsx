"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import {
  listPendingLocations,
  reviewPendingCity,
  reviewPendingDistrict,
  type PendingLocationDto,
} from "@platform/api-client";
import {
  Badge,
  Button,
  Input,
  Note,
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

function kindLabel(kind: string): string {
  return kind === "district" ? "حي" : "مدينة";
}

export function LocationsPendingView() {
  const { authReady } = usePrototype();
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
    <div className="space-y-4">
      <div>
        <h1 className="m-0 text-base font-bold text-text">
          مراجعة المسميات المبدئية
        </h1>
        <p className="mt-1 text-xs text-text-2">
          مدن وأحياء أضافها المستخدمون — اعتمد أو صحّح الاسم قبل دمجه لاحقاً.
        </p>
      </div>

      {loadError ? <Note tone="warn">{loadError}</Note> : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : items.length === 0 && !loadError ? (
        <Note tone="info">لا توجد مسميات بانتظار المراجعة.</Note>
      ) : (
        <Table className="min-w-[720px]">
          <THead>
            <Tr>
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
              <Tr key={`${item.kind}-${item.id}`}>
                <Td>
                  <Badge tone={item.kind === "district" ? "info" : "primary"}>
                    {kindLabel(item.kind)}
                  </Badge>
                </Td>
                <Td>
                  <div className="font-semibold">{item.nameAr}</div>
                  {item.rawInput && item.rawInput !== item.nameAr ? (
                    <div className="text-[10px] text-text-3">
                      المدخل: {item.rawInput}
                    </div>
                  ) : null}
                </Td>
                <Td>{item.scopeLabel || "—"}</Td>
                <Td>{item.usageCount}</Td>
                <Td>
                  <Input
                    className="min-w-[140px] text-xs"
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
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === item.id}
                      loading={busyId === item.id}
                      onClick={() => void review(item, "approve")}
                    >
                      اعتماد
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === item.id}
                      onClick={() => void review(item, "rename")}
                    >
                      تصحيح واعتماد
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
