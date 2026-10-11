import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { relativePath, repoRoot, sourceFiles, workspaceSourceRoots } from "./support/frontend-tree";

/**
 * Approved Arabic wording ratchet.
 *
 * `docs/terms/approved-terms.json` is the system dictionary: one approved wording per concept
 * and the wordings it replaced (reviewed on the «قاموس مصطلحات إجادة» page, 2026-10-08).
 * A replaced wording may not come back as a string in the screens or in backend messages.
 * `docs/terms/terms-baseline.json` lists the occurrences deliberately left (a stored value, a
 * label that mirrors Enfaz/Qeema, a parser that must keep accepting the old spelling); like
 * the size ratchets, a count may only go down.
 *
 * Matching is exact, on the text of string literals and JSX text (the same cut the review
 * page was built from), so «الغرض» banned never matches inside «الغرض من التقييم».
 */
type TermEntry = { id: string; concept: string; approved: string; rejected: string[] };
type TermsFile = { entries: TermEntry[] };
type Baseline = { note: string; allowed: Record<string, { count: number; reason: string }> };

const TERMS_PATH = "docs/terms/approved-terms.json";
const BASELINE_PATH = "docs/terms/terms-baseline.json";
const HOW_TO =
  `Use the approved wording from ${TERMS_PATH}. If the old text must stay (stored value, ` +
  `external-system label, parser input), record it in ${BASELINE_PATH} with the reason.`;

const ARABIC = /[؀-ۿ]/;
const LITERALS = [
  /"((?:[^"\\\r\n]|\\.)*)"/g,
  /'((?:[^'\\\r\n]|\\.)*)'/g,
  /`((?:[^`\\]|\\.)*)`/g,
  />([^<>{}\r\n]+)</g,
];

/** The text pieces of every string literal on Arabic lines, trimmed like the review extraction. */
function arabicStrings(source: string): string[] {
  const out: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    if (!ARABIC.test(line)) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
    for (const re of LITERALS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line))) {
        for (const raw of m[1].split(/\$\{[^}]*\}|[·|•—]/)) {
          const text = raw
            .replace(/\\n/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/^[:،,.\-–(\s«»"]+|[:،,.\-–)\s«»"؟?!]+$/g, "");
          if (text && ARABIC.test(text)) out.push(text);
        }
      }
    }
  }
  return out;
}

/** Backend C# sources that ship: no build output, no migrations (history), no test projects. */
function backendFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    if (["bin", "obj", "Migrations", "node_modules"].includes(name) || name.startsWith(".")) return [];
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return /Tests?$/.test(name) ? [] : backendFiles(path);
    return name.endsWith(".cs") ? [path] : [];
  });
}

function load<T>(path: string): T {
  return JSON.parse(readFileSync(join(repoRoot(), path), "utf8")) as T;
}

describe("approved Arabic wording ratchet", () => {
  const terms = load<TermsFile>(TERMS_PATH);
  const baseline = load<Baseline>(BASELINE_PATH);
  const isTs = (name: string) => name.endsWith(".ts") || name.endsWith(".tsx");
  const files = [
    ...workspaceSourceRoots("apps").flatMap((src) => sourceFiles(src, isTs)),
    ...workspaceSourceRoots("packages").flatMap((src) => sourceFiles(src, isTs)),
    ...backendFiles(join(repoRoot(), "backend")),
  ];

  const rejected = new Map<string, TermEntry>();
  for (const entry of terms.entries) for (const word of entry.rejected) rejected.set(word, entry);

  const counts = new Map<string, string[]>();
  for (const file of files) {
    const strings = arabicStrings(readFileSync(file, "utf8"));
    for (const text of strings) {
      if (!rejected.has(text)) continue;
      const where = counts.get(text) ?? [];
      where.push(relativePath(file));
      counts.set(text, where);
    }
  }

  it("scans the screens and the backend", () => {
    expect(files.length).toBeGreaterThan(1500);
    expect(rejected.size).toBeGreaterThan(20);
  });

  it("never lists a wording as both approved and rejected", () => {
    const approved = new Set(terms.entries.map((entry) => entry.approved));
    expect([...rejected.keys()].filter((word) => approved.has(word))).toEqual([]);
  });

  it("admits no replaced wording beyond the baseline", () => {
    const offenders = [...counts]
      .filter(([word, where]) => where.length > (baseline.allowed[word]?.count ?? 0))
      .map(([word, where]) => {
        const entry = rejected.get(word)!;
        return `«${word}» → «${entry.approved}» (${entry.id}): ${[...new Set(where)].join(", ")}`;
      });
    expect(offenders, `${HOW_TO}\n  `).toEqual([]);
  });

  it("keeps the baseline free of counts that already went down", () => {
    const stale = Object.entries(baseline.allowed)
      .filter(([word, { count }]) => (counts.get(word)?.length ?? 0) < count)
      .map(([word, { count }]) => `«${word}»: baseline ${count}, now ${counts.get(word)?.length ?? 0}`);
    expect(stale, `Lower these counts in ${BASELINE_PATH} so the old wording cannot regrow.\n  `).toEqual([]);
  });
});
