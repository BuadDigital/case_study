/** تهريب HTML موحّد لبنّائي تقرير التقييم — كان منسوخاً ثلاث مرات (live-fill / v3-preview / approved-render). */
export function escHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
