"use client";

import { Button } from "./Button";
import { Note } from "./Note";

export function QueryErrorPanel({
  message,
  onRetry,
  retrying = false,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Note tone="danger" className="mb-3 max-w-md">
        {message}
      </Note>
      {onRetry ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          loading={retrying}
          onClick={onRetry}
        >
          إعادة المحاولة
        </Button>
      ) : null}
    </div>
  );
}
