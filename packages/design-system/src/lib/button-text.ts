import { isValidElement, type ReactNode } from "react";

/** Best-effort plain text from button children for progress toasts. */
export function buttonTextFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children).replace(/\s+/g, " ").trim();
  }
  if (Array.isArray(children)) {
    return children
      .map((child) => buttonTextFromChildren(child))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return buttonTextFromChildren(children.props.children);
  }
  return "";
}
