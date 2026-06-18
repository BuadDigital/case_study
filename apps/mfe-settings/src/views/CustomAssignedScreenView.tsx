"use client";

import { use, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiBase, getCustomAssignedScreen } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import {
  Button,
  Note,
  Skeleton,
  SubpageHeader,
  SubpagePanel,
  useToast,
} from "@platform/design-system";
import { DynamicFormEngine } from "@platform/app-shared/dynamic-screens";
import { emptyDynamicScreenDefinition } from "@platform/app-shared/dynamic-screens/definition-utils";
import type { DynamicScreenDefinition } from "@platform/types";
import {
  fetchMyScreenSubmission,
  persistMyScreenSubmission,
} from "../lib/custom-screen-definition-api";
import { customScreensApiConfig } from "../lib/custom-screens-api";

type Props = {
  screenId: string;
};

export function CustomAssignedScreenView({ screenId }: Props) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const { data: screen, isPending, error } = useQuery({
    queryKey: ["custom-assigned-screen", screenId],
    queryFn: async () => {
      const session = getAuthSession();
      if (!session?.token) return null;
      const result = await getCustomAssignedScreen(
        { token: session.token, baseUrl: getApiBase() },
        screenId,
      );
      if (!result.ok) throw new Error(result.kind);
      return result.data;
    },
  });

  const { data: submission } = useQuery({
    queryKey: ["custom-screen-submission", screenId],
    enabled: Boolean(screen?.definition),
    queryFn: async () => {
      const config = customScreensApiConfig();
      if (!config) return null;
      return fetchMyScreenSubmission(config, screenId);
    },
  });

  useEffect(() => {
    if (submission?.answers) {
      setValues(submission.answers as Record<string, unknown>);
    }
  }, [submission]);

  const definition: DynamicScreenDefinition | null =
    screen?.definition ??
    (screen && !screen.targetPageId?.trim()
      ? emptyDynamicScreenDefinition(screen.code ?? "SCR-00")
      : null);

  const isDynamic =
    Boolean(definition?.bindings.length) ||
    (!screen?.targetPageId?.trim() && Boolean(screen?.definition));

  async function handleSave(isDraft: boolean): Promise<void> {
    const config = customScreensApiConfig();
    if (!config) return;
    setBusy(true);
    const result = await persistMyScreenSubmission(config, screenId, {
      answers: values,
      isDraft,
    });
    setBusy(false);
    if (!result.ok) {
      showToast("تعذر حفظ البيانات.", "error");
      return;
    }
    showToast(isDraft ? "تم حفظ المسودة." : "تم إرسال النموذج.", "success");
    void queryClient.invalidateQueries({
      queryKey: ["custom-screen-submission", screenId],
    });
  }

  if (isPending) {
    return (
      <SubpagePanel>
        <div className="space-y-4 px-6 py-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </SubpagePanel>
    );
  }

  if (error || !screen) {
    return (
      <SubpagePanel>
        <Note tone="danger" className="mx-6 my-4">
          تعذر تحميل الشاشة أو ليس لديك صلاحية الوصول إليها.
        </Note>
      </SubpagePanel>
    );
  }

  if (!isDynamic || !definition || definition.bindings.length === 0) {
    return (
      <SubpagePanel>
        <SubpageHeader title={screen.name} />
        <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-3 text-4xl opacity-40" aria-hidden>
            ◻
          </div>
          <p className="max-w-md text-sm text-text-3">
            هذه الشاشة لا تزال بدون محتوى — يقوم CDO ببناء الحقول من دليل
            الشاشات.
          </p>
        </div>
      </SubpagePanel>
    );
  }

  return (
    <SubpagePanel>
      <SubpageHeader title={screen.name} />
      <div className="space-y-4 px-6 py-4">
        <DynamicFormEngine
          definition={definition}
          values={values}
          onChange={(fieldId, value) =>
            setValues((current) => ({ ...current, [fieldId]: value }))
          }
        />
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            loading={busy}
            disabled={busy}
            onClick={() => void handleSave(true)}
          >
            حفظ مسودة
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={busy}
            disabled={busy}
            onClick={() => void handleSave(false)}
          >
            إرسال نهائي
          </Button>
        </div>
      </div>
    </SubpagePanel>
  );
}

export function CustomAssignedScreenPage({
  params,
}: {
  params: Promise<{ screenId: string }>;
}) {
  const { screenId } = use(params);
  return <CustomAssignedScreenView screenId={screenId} />;
}
