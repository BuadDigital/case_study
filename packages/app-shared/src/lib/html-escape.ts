/** System-wide HTML escape — previously copied in at least four files. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Common alias used in valuation-report builders. */
export const escHtml = escapeHtml;
