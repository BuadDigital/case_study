import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcFile = path.join(__dirname, "_أوامر العمل - نسخة مستقلة.html");
const html = fs.readFileSync(srcFile, "utf8");

function extractScript(type) {
  const re = new RegExp(
    `<script type="${type}">([\\s\\S]*?)</script>`,
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

const templateRaw = extractScript("__bundler/template");
const manifestRaw = extractScript("__bundler/manifest");

if (!templateRaw) {
  console.error("template not found");
  process.exit(1);
}

let template = JSON.parse(templateRaw);
const manifest = manifestRaw ? JSON.parse(manifestRaw) : {};

let inlined = 0;
for (const uuid of Object.keys(manifest)) {
  const entry = manifest[uuid];
  let b64 = entry.data;
  try {
    if (entry.compressed) {
      const buf = Buffer.from(entry.data, "base64");
      const un = zlib.gunzipSync(buf);
      b64 = un.toString("base64");
    }
  } catch (e) {
    console.warn("decompress failed for", uuid, e.message);
  }
  const dataUri = `data:${entry.mime};base64,${b64}`;
  if (template.includes(uuid)) {
    template = template.split(uuid).join(dataUri);
    inlined++;
  }
}

const outFile = path.join(__dirname, "po_extracted.html");
fs.writeFileSync(outFile, template, "utf8");

// Also write a CSS/markup-only version (strip data: URIs to keep it readable)
const readable = template.replace(/data:[^"')\s]+/g, "ASSET");
fs.writeFileSync(path.join(__dirname, "po_extracted.readable.html"), readable, "utf8");

console.log("template length:", template.length);
console.log("assets inlined:", inlined, "of", Object.keys(manifest).length);
console.log("wrote:", outFile);
