"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Input,
  Label,
  Note,
  SubpageHeader,
  SubpagePanel,
  Skeleton,
  useToast,
} from "@platform/design-system";
import {
  DynamicFormEngine,
  emptyDynamicScreenDefinition,
} from "@platform/app-shared/dynamic-screens";
import type { CustomAssignedScreen, DynamicScreenDefinition } from "@platform/types";
import { PAGE_TITLES } from "@platform/app-shared/prototype/constants";
import { customScreensApiConfig } from "../../lib/custom-screens-api";
import {
  fetchCustomScreenForBuilder,
  persistDynamicScreenDefinition,
} from "../../lib/custom-screen-definition-api";
import { invalidateCustomAssignedScreensQueries } from "../../query/custom-screens-queries";
import { syncFieldDictionaryFromSystem } from "../../lib/prototype/field-dictionary-api";
import {
  LayoutCanvas,
  appendFieldToDefinition,
} from "./LayoutCanvas";
import { InlineFieldCreateModal } from "./InlineFieldCreateModal";

type Props = {
  screenId: string;
};

function initialDefinition(screen: CustomAssignedScreen): DynamicScreenDefinition {
  if (screen.definition) return screen.definition;
  return emptyDynamicScreenDefinition(screen.code ?? "SCR-01");
}

export function CustomScreenBuilder({ screenId }: Props) {
  const queryClient = useQueryClient();
  const [definition, setDefinition] = useState<DynamicScreenDefinition | null>(
    null,
  );
  const [fieldQuery, setFieldQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const { data: screen, isPending, error } = useQuery({
    queryKey: ["custom-screen-builder", screenId],
    queryFn: async () => {
      const config = customScreensApiConfig();
      if (!config) return null;
      return fetchCustomScreenForBuilder(config, screenId);
    },
  });

  useEffect(() => {
    if (!screen) return;
    setDefinition(initialDefinition(screen));
  }, [screen]);

  const assignedUserLabel =
    screen?.assignedUsers?.map((user) => user.displayName).join("، ") ?? "—";

  const availableFields = useMemo(() => {
    if (!definition) return [];
    const used = new Set(definition.bindings.map((binding) => binding.fieldId));
    return definition.fields.filter((field) => {
      if (used.has(field.id)) return false;
      if (!fieldQuery.trim()) return true;
      const q = fieldQuery.trim();
      return field.name.includes(q) || field.ref.includes(q);
    });
  }, [definition, fieldQuery]);

  async function handleSave(): Promise<void> {
    if (!definition || !screen) return;
    if (definition.bindings.length === 0) {
      window.alert("أضف حقلاً واحداً على الأقل.");
      return;
    }

    const config = customScreensApiConfig();
    if (!config) return;

    setBusy(true);
    const result = await persistDynamicScreenDefinition(config, screenId, {
      code: definition.code,
      ownerRole: "",
      fields: definition.fields,
      bindings: definition.bindings,
    });
    setBusy(false);

    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }

    setDefinition(result.screen.definition ?? definition);
    showToast("تم حفظ الشاشة.", "success");
    invalidateCustomAssignedScreensQueries(queryClient);
    void syncFieldDictionaryFromSystem();
  }

  if (isPending || !definition) {
    return (
      <SubpagePanel>
        <div className="space-y-4 px-6 py-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </SubpagePanel>
    );
  }

  if (error || !screen) {
    return (
      <SubpagePanel>
        <Note tone="danger" className="mx-6 my-4">
          تعذر تحميل الشاشة أو ليس لديك صلاحية التعديل.
        </Note>
      </SubpagePanel>
    );
  }

  if (screen.targetPageId?.trim()) {
    const linkedTitle =
      PAGE_TITLES[screen.targetPageId as keyof typeof PAGE_TITLES]
      ?? screen.targetPageId;
    return (
      <SubpagePanel>
        <SubpageHeader title={`تصميم الشاشة: ${screen.name}`}>
          <Link
            href="/system-screen-catalog"
            className="text-xs text-text-3 underline-offset-2 hover:underline"
          >
            ← دليل الشاشات
          </Link>
        </SubpageHeader>
        <Note tone="info" className="mx-6 my-4">
          هذه الشاشة مرتبطة بـ «{linkedTitle}». عدّل الربط من «إعدادات» في دليل
          الشاشات، أو اختر «شاشة ديناميكية جديدة» لبناء حقول مخصصة.
        </Note>
      </SubpagePanel>
    );
  }

  return (
    <SubpagePanel>
      <SubpageHeader title={`تصميم الشاشة: ${screen.name}`}>
        <Link
          href="/system-screen-catalog"
          className="text-xs text-text-3 underline-offset-2 hover:underline"
        >
          ← دليل الشاشات
        </Link>
      </SubpageHeader>

      <div className="grid gap-4 p-4 xl:grid-cols-2">
        <section className="space-y-4">
          <div className="rounded border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-text">① بيانات الشاشة</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>اسم الشاشة في القائمة</Label>
                <Input value={screen.name} readOnly className="bg-surface-2" />
              </div>
              <div>
                <Label>الرمز</Label>
                <Input
                  value={definition.code}
                  readOnly
                  className="bg-surface-2 font-mono text-xs"
                />
              </div>
              <div>
                <Label>الحالة</Label>
                <div className="mt-1">
                  <Badge
                    tone={
                      definition.status === "موجودة" ? "success" : "warning"
                    }
                  >
                    {definition.status}
                  </Badge>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-text-3">
              المستخدمون المسندون: {assignedUserLabel}
            </p>
          </div>

          <div className="rounded border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-text">② حقول الشاشة</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCreateOpen(true)}
              >
                ＋ حقل جديد
              </Button>
            </div>
            <Input
              value={fieldQuery}
              onChange={(event) => setFieldQuery(event.target.value)}
              placeholder="ابحث في حقول هذه الشاشة…"
              className="mb-3"
            />
            <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-border">
              {availableFields.length === 0 ? (
                <p className="px-3 py-4 text-center text-[11px] text-text-3">
                  لا توجد حقول متاحة للإضافة.
                </p>
              ) : (
                availableFields.map((field) => (
                  <button
                    key={field.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-start text-sm last:border-b-0 hover:bg-surface-2"
                    onClick={() =>
                      setDefinition((current) =>
                        current
                          ? appendFieldToDefinition(current, field.id)
                          : current,
                      )
                    }
                  >
                    <span>
                      <span className="font-mono text-[10px] text-text-3">
                        {field.ref}
                      </span>{" "}
                      {field.name}
                    </span>
                    <span className="text-lg text-primary">＋</span>
                  </button>
                ))
              )}
            </div>
            <div className="mt-4">
              <LayoutCanvas definition={definition} onChange={setDefinition} />
            </div>
          </div>
        </section>

        <section className="rounded border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-text">
            ③ معاينة حية
          </h2>
          <div className="rounded border border-border bg-surface-2 p-3">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2">
              <p className="text-sm font-semibold text-text">{screen.name}</p>
              <Badge tone="info">{assignedUserLabel}</Badge>
            </div>
            <DynamicFormEngine
              definition={definition}
              values={previewValues}
              preview
              onChange={(fieldId, value) =>
                setPreviewValues((current) => ({
                  ...current,
                  [fieldId]: value,
                }))
              }
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              loading={busy}
              disabled={busy}
              onClick={() => void handleSave()}
            >
              حفظ الشاشة
            </Button>
          </div>
        </section>
      </div>

      {createOpen ? (
        <InlineFieldCreateModal
          definition={definition}
          onSave={(next) => {
            setDefinition(next);
            setCreateOpen(false);
          }}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}
    </SubpagePanel>
  );
}

export function CustomScreenBuilderPage({
  params,
}: {
  params: Promise<{ screenId: string }>;
}) {
  const { screenId } = use(params);
  return <CustomScreenBuilder screenId={screenId} />;
}
