// Session-local: «أعمالي» for both deeds of the merged transaction (merge done by linked2).
import fs from "node:fs";
import { call, myWork, useState, closeBrowser } from "./.az-2026-11-09.mjs";
const states = JSON.parse(fs.readFileSync("test-results/az-2026-11-09-linked/states.json", "utf8"));
const tx = await call("study", "GET", `/api/transactions/by-property/${states[0].propertyId}`);
console.log("transaction:", tx.id, "deeds:", (tx.properties ?? tx.deeds ?? []).length, "holder:", tx.studyHolderPropertyId, "linkKind:", tx.linkKind, "ref:", tx.referenceNumber);
const tasks = await call("study", "GET", `/api/workflow-tasks?poNumber=${encodeURIComponent(states[0].po)}`);
for (const t of tasks.filter((x) => x.kind === "case-study-property")) console.log(" task", t.deedNumber, t.transactionNumber, "holder=", t.transactionStudyHolderPropertyId ?? "self", "received=", t.transactionReceived);
for (const s of states) { useState(s); for (const u of ["coord", "study"]) await myWork(u, `L5-${s.deed.slice(-4)}`); }
await closeBrowser();
process.exit(0);
