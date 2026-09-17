import { PoNumber } from "@platform/ui-kit";

/** Realistic formatted PO code inline within an Arabic sentence (bidi-isolated). */
export function Default() {
  return (
    <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
      طلب المعاينة <PoNumber value="2026-0005" /> بانتظار اعتماد الأخصائي.
    </p>
  );
}

/** Value already carries the PO- prefix — passed through unchanged. */
export function AlreadyPrefixed() {
  return (
    <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
      رقم الطلب: <PoNumber value="PO-2026-0013" />
    </p>
  );
}

/** Rendered as a link (consumer supplies the anchor via children). */
export function AsLink() {
  return (
    <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
      راجع{" "}
      <PoNumber value="2026-0022">
        <a
          href="#"
          className="text-primary underline decoration-primary underline-offset-2"
          dir="ltr"
        >
          PO-2026-0022
        </a>
      </PoNumber>
    </p>
  );
}
