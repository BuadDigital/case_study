const EXACT_MESSAGES: Record<string, string> = {
  "حفظ أمر العمل": "جاري حفظ أمر العمل…",
  "حفظ التعديلات": "جاري حفظ التعديلات…",
  "حفظ وإرسال المعاينة": "جاري إرسال المعاينة…",
  "حفظ وإتمام المراجعة": "جاري إتمام المراجعة…",
  "حفظ وإتمام التقييم": "جاري إرسال التقييم…",
  "حفظ وإرسال الرفع": "جاري إرسال الرفع المساحي…",
  "حفظ وإكمال البورصة": "جاري حفظ بيانات البورصة…",
  "تأكيد التوزيع وإرسال المهام": "جاري تأكيد التوزيع وإرسال المهام…",
  "إرسال للأخصائي": "جاري إرسال التقييم للأخصائي…",
  "إرسال للمشرف — إدارة التعذرات": "جاري إرسال التعذر للمشرف…",
  "حفظ والانتقال للتوزيع": "جاري الحفظ والانتقال للتوزيع…",
  "حفظ مسودة": "جاري حفظ المسودة…",
  "حفظ إجاباتي": "جاري حفظ الإجابات…",
  "حفظ الحقل": "جاري حفظ الحقل…",
  "حفظ الإسناد": "جاري حفظ الإسناد…",
  "تأكيد الحفظ": "جاري إنشاء الحساب…",
  "رفع النموذج للنظام": "جاري رفع نموذج الدراسة…",
  "دخول": "جاري تسجيل الدخول…",
  "إرفاق صورة": "جاري إرفاق الصورة…",
  "تسجيل تعذر": "جاري تسجيل التعذر…",
};

const KEYWORD_MESSAGES: { keyword: string; message: string }[] = [
  { keyword: "إرسال", message: "جاري الإرسال…" },
  { keyword: "حذف", message: "جاري الحذف…" },
  { keyword: "تأكيد", message: "جاري التأكيد…" },
  { keyword: "رفع", message: "جاري الرفع…" },
  { keyword: "تحميل", message: "جاري التحميل…" },
  { keyword: "إضافة", message: "جاري الإضافة…" },
  { keyword: "إرفاق", message: "جاري الإرفاق…" },
  { keyword: "اعتماد", message: "جاري الاعتماد…" },
  { keyword: "حفظ", message: "جاري الحفظ…" },
  { keyword: "تسجيل", message: "جاري التسجيل…" },
  { keyword: "تحديث", message: "جاري التحديث…" },
  { keyword: "استيراد", message: "جاري الاستيراد…" },
  { keyword: "تنفيذ", message: "جاري التنفيذ…" },
  { keyword: "إنشاء", message: "جاري الإنشاء…" },
];

const SKIP_ACTION_LABELS = new Set([
  "إلغاء",
  "الغاء",
  "رجوع",
  "إغلاق",
  "رجوع للقائمة",
  "تخطي",
  "التالي",
  "السابق",
  "عرض",
  "معاينة",
  "تحرير",
  "⋮",
]);

/** Maps a button label to a short Arabic progress toast. */
export function progressMessageForActionLabel(actionLabel: string): string {
  const label = actionLabel.replace(/\s+/g, " ").trim();
  if (!label) return "جاري التنفيذ…";

  const exact = EXACT_MESSAGES[label];
  if (exact) return exact;

  for (const { keyword, message } of KEYWORD_MESSAGES) {
    if (label.includes(keyword)) return message;
  }

  return "جاري التنفيذ…";
}

export function isActionLikeLabel(actionLabel: string): boolean {
  const label = actionLabel.replace(/\s+/g, " ").trim();
  if (!label || SKIP_ACTION_LABELS.has(label)) return false;
  if (EXACT_MESSAGES[label]) return true;
  return KEYWORD_MESSAGES.some(({ keyword }) => label.includes(keyword));
}

export function shouldShowActionProgressToast(
  actionLabel: string,
  variant: string,
): boolean {
  const label = actionLabel.replace(/\s+/g, " ").trim();
  if (!label || SKIP_ACTION_LABELS.has(label)) return false;
  if (variant === "ghost") return false;
  return true;
}

export function inferButtonVariant(element: HTMLElement): string {
  const explicit = element.getAttribute("data-button-variant");
  if (explicit) return explicit;

  const cls =
    typeof element.className === "string" ? element.className : "";
  if (
    cls.includes("bg-primary") ||
    (cls.includes("border-primary") && cls.includes("text-white"))
  ) {
    return "primary";
  }
  if (cls.includes("text-danger") || cls.includes("bg-danger")) {
    return "danger";
  }
  if (cls.includes("border-transparent") && cls.includes("bg-transparent")) {
    return "ghost";
  }
  return "default";
}

export function labelFromActionElement(element: HTMLElement): string {
  const custom = element.getAttribute("data-action-label")?.trim();
  if (custom) return custom;

  if (
    element instanceof HTMLInputElement &&
    (element.type === "submit" || element.type === "button")
  ) {
    return (element.value || "").replace(/\s+/g, " ").trim();
  }

  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function shouldShowGlobalActionToast(
  element: HTMLElement,
  label: string,
): boolean {
  if (element.closest("[data-no-action-toast]")) return false;
  if (element.hasAttribute("data-no-action-toast")) return false;
  if (element.closest('[role="tablist"]')) return false;
  if (element.closest("nav[aria-label]") && !isActionLikeLabel(label)) {
    return false;
  }

  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized || SKIP_ACTION_LABELS.has(normalized)) return false;

  if (element.hasAttribute("data-action-toast")) return true;

  const variant = inferButtonVariant(element);
  if (variant === "ghost") return false;

  if (
    element instanceof HTMLInputElement &&
    (element.type === "submit" || element.type === "button")
  ) {
    return isActionLikeLabel(normalized);
  }

  if (element.getAttribute("type") === "submit") return true;

  if (
    variant === "primary" ||
    variant === "success" ||
    variant === "accent" ||
    variant === "danger"
  ) {
    return true;
  }

  return isActionLikeLabel(normalized);
}
