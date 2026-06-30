export type PrototypeLoginUser = {
  username: string;
  label: string;
};

/** CDO dev account — pinned first on the login picker. */
export const PROTOTYPE_CDO_LOGIN_USERNAME = "sliman";

/** Dev login quick-pick — usernames match `DataSeeder` HR staff and proc providers. */
export const PROTOTYPE_LOGIN_USERS: PrototypeLoginUser[] = [
  { username: "sliman", label: "سليمان — مسؤول التحول الرقمي (CDO)" },
  { username: "alaa", label: "آلاء قمصاني — أخصائية موارد بشرية" },
  { username: "ali", label: "علي الأمين — مدير المالية والعقود" },
  { username: "shahd", label: "شهد العماري — مدير علاقات العملاء" },
  { username: "salam", label: "سالم الغريب — مدير إدارة التقييم العقاري" },
  { username: "abdulrahman", label: "عبدالرحمن النفيعي — مشرف قسم دراسة الحالة" },
  { username: "osama", label: "أسامة الصالحي — أخصائي دراسة حالة" },
  { username: "feras", label: "فراس كمرين — مراجع حكومي" },
  { username: "mohammed", label: "محمد دياب — منسق عمليات التقييم" },
  { username: "abdullah", label: "عبدالله الكثيري — مقيم عقاري" },
  { username: "ahmed", label: "أحمد سعيد — معاين ميداني (متعاون)" },
  { username: "abdullah_m", label: "عبدالله عبدالمانع — معاين ميداني" },
  { username: "eman", label: "إيمان النهدي — موظف الشؤون المالية" },
  { username: "jeddah_survey", label: "مكتب جدة للمساحة — مزود مسح ميداني" },
];

export function sortLoginUsersForPicker<T extends { username: string; label: string }>(
  users: readonly T[],
): T[] {
  return [...users].sort((a, b) => {
    if (a.username === PROTOTYPE_CDO_LOGIN_USERNAME) return -1;
    if (b.username === PROTOTYPE_CDO_LOGIN_USERNAME) return 1;
    return a.label.localeCompare(b.label, "ar", { numeric: true });
  });
}
