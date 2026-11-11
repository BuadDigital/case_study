"use client";

import { useRouter } from "next/navigation";
import { Button } from "@platform/ui-kit";

/** A step worked elsewhere: what it is, and the button that opens it. */
export function StepLink({
  line,
  label,
  href,
}: {
  line: string;
  label: string;
  href: string | null;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-3 pt-3">
      <span className="flex-1 text-[12.5px] text-text-2">{line}</span>
      {href ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => router.push(href)}
        >
          {label}
        </Button>
      ) : null}
    </div>
  );
}
