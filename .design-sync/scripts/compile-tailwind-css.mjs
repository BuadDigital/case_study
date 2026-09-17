// Compiles apps/shell/src/app/globals.css (the real Tailwind v4 entry, with the
// full @theme token mapping) into a static stylesheet for the ui-kit design-sync.
// ui-kit ships no compiled CSS of its own — utilities are generated at app-build
// time by Tailwind's @source scan, so we replicate that here. Re-run before every
// design-sync build/resync.
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const entry = path.join(repoRoot, "apps/shell/src/app/globals.css");
const outDir = path.join(repoRoot, "packages/ui-kit/.ds-sync-cache");
const outFile = path.join(outDir, "ui-kit-tailwind.css");

const css = fs.readFileSync(entry, "utf8");
const result = await postcss([tailwind({ base: repoRoot })]).process(css, {
  from: entry,
  to: outFile,
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, result.css, "utf8");
console.log(`wrote ${outFile} (${(result.css.length / 1024).toFixed(1)} KB)`);
