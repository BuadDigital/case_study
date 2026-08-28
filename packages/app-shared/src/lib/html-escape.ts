/** تهريب HTML موحّد على مستوى النظام — كان منسوخاً في أربعة ملفات على الأقل. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** اسم بديل شائع في بنّائي تقرير التقييم. */
export const escHtml = escapeHtml;
