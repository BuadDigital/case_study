import { useEffect, useRef, type ReactNode } from "react";
import { RowMoreMenu } from "@platform/ui-kit";

/**
 * RowMoreMenu has no `open`/`defaultOpen` prop — it only opens on a real
 * click. The static capture harness has no interaction/play step, so we
 * simulate the click ourselves right after mount to get a screenshot of
 * the open menu instead of just the closed kebab trigger.
 */
function OpenOnMount({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current
      ?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')
      ?.click();
  }, []);
  return <div ref={ref}>{children}</div>;
}

export function Default() {
  return (
    <div style={{ padding: 56, display: "flex", justifyContent: "flex-end" }}>
      <OpenOnMount>
        <RowMoreMenu
          items={[
            { id: "view", label: "عرض التفاصيل", onClick: () => {} },
            { id: "edit", label: "تعديل", onClick: () => {} },
            { id: "delete", label: "حذف", danger: true, onClick: () => {} },
          ]}
        />
      </OpenOnMount>
    </div>
  );
}
