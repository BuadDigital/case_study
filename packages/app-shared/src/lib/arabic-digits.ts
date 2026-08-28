const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** تحويل الأرقام العربية الشرقية إلى لاتينية — محروس: أي محرف خارج المدى يمرّ كما هو. */
export function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (ch) => {
    const i = ARABIC_DIGITS.indexOf(ch);
    return i >= 0 ? String(i) : ch;
  });
}
