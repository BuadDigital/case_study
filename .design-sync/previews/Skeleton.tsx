import { Skeleton } from "@platform/ui-kit";

/** Text-line placeholder bars — a realistic shimmer block for a card body. */
export function TextLines() {
  return (
    <div style={{ maxWidth: 320, display: "flex", flexDirection: "column", gap: 8 }}>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/** Avatar + label placeholder pair, as used in a compact loading row. */
export function AvatarRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Skeleton className="h-10 w-10 rounded-full" />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-20" />
      </div>
    </div>
  );
}
