"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiBase, getCustomAssignedScreen } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { Note, SubpageHeader, SubpagePanel } from "@platform/design-system";

type Props = {
  screenId: string;
};

export function CustomAssignedScreenView({ screenId }: Props) {
  const { data, isPending, error } = useQuery({
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

  if (isPending) {
    return (
      <SubpagePanel>
        <p className="px-6 py-4 text-xs text-text-3">جاري التحميل…</p>
      </SubpagePanel>
    );
  }

  if (error || !data) {
    return (
      <SubpagePanel>
        <Note tone="danger" className="mx-6 my-4">
          تعذر تحميل الشاشة أو ليس لديك صلاحية الوصول إليها.
        </Note>
      </SubpagePanel>
    );
  }

  return (
    <SubpagePanel>
      <SubpageHeader title={data.name} />
      <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-3 text-4xl opacity-40" aria-hidden>
          ◻
        </div>
        <p className="max-w-md text-sm text-text-3">
          هذه الشاشة المخصصة لا تزال بدون محتوى
        </p>
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
