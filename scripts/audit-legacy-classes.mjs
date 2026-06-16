import fs from "fs";
import { execSync } from "child_process";

const cssPath = "packages/design-system/src/styles/tokens.css";
const css = fs.readFileSync(cssPath, "utf8");
const classDefs = new Set();
for (const m of css.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
  classDefs.add(m[1]);
}

const files = execSync(
  'git ls-files "apps/**/*.tsx" "apps/**/*.jsx" "packages/**/*.tsx" "packages/**/*.jsx"',
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);

const classUsage = new Map();
const classNameRe =
  /className=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const m of content.matchAll(classNameRe)) {
    const cls = m[1] || m[2] || m[3] || "";
    for (const token of cls.split(/\s+/)) {
      if (!token || token.includes("${")) continue;
      if (!classDefs.has(token)) continue;
      if (!classUsage.has(token)) classUsage.set(token, new Set());
      classUsage.get(token).add(file);
    }
  }
}

const sorted = [...classUsage.entries()]
  .map(([cls, fileSet]) => [cls, fileSet.size, [...fileSet]])
  .sort((a, b) => b[1] - a[1]);

console.log("class\tfile_count\ttotal_refs");
for (const [cls, count] of sorted) {
  console.log(`${cls}\t${count}`);
}
console.log(`\nTOTAL_UNIQUE_CLASSES\t${sorted.length}`);
const allFiles = new Set(sorted.flatMap(([, , files]) => files));
console.log(`TOTAL_FILES\t${allFiles.size}`);
