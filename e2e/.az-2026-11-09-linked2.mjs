// Session-local: continue the linked-deeds edge (states from .az-2026-11-09-linked.mjs): deed A is
// received, deed B is not; merge B into A — who may, and what «أعمالي» shows after.
import fs from "node:fs";
import { call, myWork, useState, closeBrowser } from "./.az-2026-11-09.mjs";
const states = JSON.parse(fs.readFileSync("test-results/az-2026-11-09-linked/states.json", "utf8"));
const tx = await call("coord", "GET", `/api/transactions/by-property/${states[0].propertyId}`);
const body = { propertyIds: [states[1].propertyId], linkKind: "one_building", reason: "الصكان لعمارة واحدة على قطعتين" };
for (const u of ["coord", "study"]) {
  try { const m = await call(u, "POST", `/api/transactions/${tx.id}/merge`, body); console.log(`merge as ${u}: OK`, JSON.stringify(m).slice(0, 200)); break; }
  catch (e) { console.log(`merge as ${u}: ${e.message.slice(0, 300)}`); }
}
const after = await call("coord", "GET", `/api/transactions/by-property/${states[1].propertyId}`);
console.log("B's transaction:", after.id === tx.id ? "same as A" : "separate", "received:", after.receivedAtUtc ?? null);
for (const s of states) { useState(s); for (const u of ["coord", "study"]) await myWork(u, `L4-${s.deed.slice(-4)}`); }
await closeBrowser();
