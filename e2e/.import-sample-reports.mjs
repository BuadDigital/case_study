// Session-local (2026-11-15): imports a small sample مقياس export (test data) for the map-layer demo.
//   node e2e/.import-sample-reports.mjs <path to xlsx>
import fs from "node:fs";
const API = "http://127.0.0.1:5160";
const file = process.argv[2];
const login = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "500000001" }) });
const { token } = await login.json();
const call = async (method, path, body) => {
  const r = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  console.log(`${method} ${path} → ${r.status}`);
  return json;
};
const request = { source: "meqyas", fileName: "meqyas-sample.xlsx", contentBase64: fs.readFileSync(file).toString("base64") };
console.log("sources:", JSON.stringify(await call("GET", "/api/valuation-report-imports/sources")));
const preview = await call("POST", "/api/valuation-report-imports/preview", request);
console.log("preview:", JSON.stringify(preview).slice(0, 900));
if (process.env.COMMIT === "1") {
  console.log("commit:", JSON.stringify(await call("POST", "/api/valuation-report-imports", request)).slice(0, 600));
  const points = await call("GET", "/api/valuation-report-imports/map-points");
  console.log("map points:", Array.isArray(points) ? points.length : JSON.stringify(points).slice(0, 300), JSON.stringify(points?.[0] ?? null));
}
