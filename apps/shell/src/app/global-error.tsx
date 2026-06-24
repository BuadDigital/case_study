"use client";

import { useEffect } from "react";
import { Button, Note } from "@platform/design-system";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-bg p-6">
      <div className="max-w-md text-center">
        <Note tone="danger" className="mb-4">
          حدث خطأ عام في التطبيق.
        </Note>
        <p className="mb-4 text-sm text-text-3">{error.message}</p>
        <Button type="button" variant="primary" onClick={() => reset()}>
          إعادة المحاولة
        </Button>
      </div>
    </div>
  );
}
