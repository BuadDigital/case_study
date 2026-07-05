import {
  CASE_STUDY_INFO_PARTIES,
  CASE_STUDY_INFO_ROLE_TYPES,
  CASE_STUDY_INFO_SECTIONS,
  CASE_STUDY_QUESTION_CATALOG,
} from "./case-study-info-roles-data";
import type { CaseStudyInfoRolesConfig } from "./case-study-info-roles-storage";

export function formatCaseStudyInfoRolesMarkdown(
  config: CaseStudyInfoRolesConfig,
  sourceUrl?: string,
): string {
  const updated = config.updatedAt || new Date().toISOString();
  const lines: string[] = [
    "# علاقة المستخدم بالمعلومة — نموذج دراسة الحالة",
    "",
    `> **آخر تحديث:** ${updated}`,
  ];
  if (sourceUrl) {
    lines.push(`> **المصدر:** ${sourceUrl}`);
  }
  lines.push(
    "",
    "حدّد لكل سؤال في نموذج دراسة الحالة: من الأطراف المعنيين وما دوره (أصيل / ثانوي / معتمد). تُطبَّق القواعد على تبويب «نموذج الدراسة» في معاملات الأطراف.",
    "",
    "---",
    "",
    "## الأطراف",
    "",
    "| الرمز | الطرف |",
    "|-------|-------|",
    ...CASE_STUDY_INFO_PARTIES.map((p) => `| ${p.id} | ${p.name} |`),
    "",
    "## أنواع الأدوار",
    "",
    "| الدور | المعنى |",
    "|-------|--------|",
    "| **أصيل** | المسؤول الأساسي عن المعلومة |",
    "| **ثانوي** | مساهم — قد يكون مصدراً أولاً دون أن يكون المسؤول الأساسي |",
    "| **معتمد** | يراجع ويعتمد صحة المعلومة (ليس معتمد التقرير) |",
    "| **لا دور** | بدون صلاحية إجابة |",
    "",
    "---",
    "",
  );

  CASE_STUDY_INFO_SECTIONS.forEach((sec, secIdx) => {
    lines.push(`## ${secIdx + 1}. ${sec.label}`, "");
    const qs = CASE_STUDY_QUESTION_CATALOG.filter((q) => q.section === sec.id);
    qs.forEach((q, qIdx) => {
      lines.push(`### ${qIdx + 1}. ${q.text}`, "");
      const row = config.matrix[q.key] ?? {};
      const entries = CASE_STUDY_INFO_PARTIES.flatMap((party) => {
        const role = row[party.id];
        if (!role || role === "none") return [];
        const roleType = CASE_STUDY_INFO_ROLE_TYPES.find((r) => r.id === role);
        return [{ party: party.name, role: roleType?.label ?? role }];
      });

      if (entries.length === 0) {
        lines.push("_لا أدوار مسندة_", "");
      } else {
        lines.push("| الطرف | الدور |", "|-------|-------|");
        for (const entry of entries) {
          lines.push(`| ${entry.party} | ${entry.role} |`);
        }
        lines.push("");
      }

      const note = config.notes[q.key]?.trim();
      if (note) {
        lines.push(`_ملاحظة:_ ${note}`, "");
      }
    });
  });

  return `${lines.join("\n")}\n`;
}

export function downloadCaseStudyInfoRolesMarkdown(
  config: CaseStudyInfoRolesConfig,
  filename = "case-study-info-roles.md",
): void {
  const sourceUrl =
    typeof window !== "undefined" ? window.location.href : undefined;
  const markdown = formatCaseStudyInfoRolesMarkdown(config, sourceUrl);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
