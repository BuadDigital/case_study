// حارس استيرادات البراميل: أي `from "@<mfe>/mfe"` بجذر الحزمة يسحب كل شاشاتها
// إلى حزمة المستورد (bundle-barrel-imports). الاستيرادات العميقة
// (@x/mfe/lib/...) مسموحة. صفر مخالفات منذ 32c7c16b — هذا يبقيها صفراً.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["apps", "packages"];
const BARREL_RE =
  /from\s+["']@(?:case-study|settings|failures|evaluator|engineering-office|financial|keys|survey|valuation|dashboard)\/mfe["']/;
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build"]);

const offenders = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    const lines = readFileSync(full, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (BARREL_RE.test(line)) {
        offenders.push(`${full}:${i + 1}: ${line.trim()}`);
      }
    });
  }
}

for (const root of ROOTS) {
  for (const pkg of readdirSync(root)) {
    const src = join(root, pkg, "src");
    try {
      if (statSync(src).isDirectory()) walk(src);
    } catch {
      /* لا src — تجاهل */
    }
  }
}

if (offenders.length > 0) {
  console.error(
    "استيرادات برميل MFE ممنوعة — استخدم مساراً عميقاً للوحدة المعرِّفة:\n",
  );
  for (const line of offenders) console.error("  " + line);
  process.exit(1);
}
console.log("check-barrel-imports: OK (0 barrel imports)");
