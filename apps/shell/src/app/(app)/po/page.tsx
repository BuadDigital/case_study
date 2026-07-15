import { Suspense } from "react";
import { PoListView } from "@case-study/mfe";
import "./po-list-typography.css";

export default function PoPage() {
  return (
    <div className="po-list-type">
      <Suspense fallback={null}>
        <PoListView />
      </Suspense>
    </div>
  );
}
