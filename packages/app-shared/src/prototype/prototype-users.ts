export type PrototypeLoginUser = {
  username: string;
  label: string;
};

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
