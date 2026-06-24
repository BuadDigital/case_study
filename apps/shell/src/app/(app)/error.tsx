"use client";

import { Button, Note } from "@platform/design-system";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-md text-center">
        <Note tone="danger" className="mb-4">
          تعذّر تحميل هذه الصفحة.
        </Note>
        <p className="mb-4 text-sm text-text-3">{error.message}</p>
        <Button type="button" variant="primary" onClick={() => reset()}>
          إعادة المحاولة
        </Button>
      </div>
    </div>
  );
}
