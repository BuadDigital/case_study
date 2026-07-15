import { Suspense } from "react";
import { PoListView } from "@case-study/mfe";

export default function PoPage() {
  return (
    <Suspense fallback={null}>
      <PoListView />
    </Suspense>
  );
}
