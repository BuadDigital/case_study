const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Convert Eastern Arabic digits to Latin — guarded: any char outside the range passes through. */
export function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (ch) => {
    const i = ARABIC_DIGITS.indexOf(ch);
    return i >= 0 ? String(i) : ch;
  });
}
