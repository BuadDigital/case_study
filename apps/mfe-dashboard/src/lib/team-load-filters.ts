const TEAM_LOAD_ROLE_LABELS = [
  "دراسة حالة العقارات",
  "مراجع حكومي",
  "منسق التقييم",
  "معاين ميداني",
  "مكتب هندسي",
] as const;

const EXCLUDED_TEAM_LOAD_NAMES = new Set(["أحمد سعيد"]);

/** Hide placeholder rows where assignee name repeats the role title. */
export function isTeamLoadPlaceholderRow(name: string, roleLabel: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (trimmed === roleLabel.trim()) return true;
  if (TEAM_LOAD_ROLE_LABELS.some((label) => trimmed === label)) return true;
  if (EXCLUDED_TEAM_LOAD_NAMES.has(trimmed)) return true;
  return false;
}
