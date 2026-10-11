// Builds a disposable transaction whose inspector draft is a full copy of PO-AZ-2026-002's (photos re-uploaded
// under the new task), WITHOUT submitting it — so the wizard's «حفظ وإرسال» can be exercised in the browser.
// Run from the repo root:  node --import <ts-resolver> e2e/.prepare-inspection-clone.mjs
import { execFileSync } from "node:child_process";
import {
  apiLogin,
  apiOk,
  createDistributedTransaction,
  uploadAttachment,
  TINY_PNG_BASE64,
} from "./fixtures/transaction.ts";

const SOURCE_TASK = "946a7a60-d3c4-4626-98cf-6eb34ae8b8d7";
const psql = (sql) =>
  execFileSync(
    "docker",
    ["exec", "ree-postgres", "psql", "-U", "postgres", "-d", "realestate_eval_attachments", "-At", "-F", "|", "-c", sql],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("|"));

const osama = await apiLogin("osama");
const tx = await createDistributedTransaction(osama);
const taskId = tx.fieldInspection.id;
const ahmed = await apiLogin("ahmed");

const source = await apiOk(ahmed, "GET", `/api/party-task-submissions/${SOURCE_TASK}`);
const payload = JSON.parse(JSON.stringify(source.payload ?? source));

// old attachment id -> new attachment (same scope key suffix, new task)
const rows = psql(
  `select "Id","ScopeKey" from attachments."FileAttachments" where "Scope"='field-inspection-photo' and "ScopeKey" like '${SOURCE_TASK}:%'`,
);
const mapping = new Map();
for (const [id, scopeKey] of rows) {
  const suffix = scopeKey.slice(SOURCE_TASK.length + 1);
  const meta = await uploadAttachment(ahmed, {
    scope: "field-inspection-photo",
    scopeKey: `${taskId}:${suffix}`,
    fileName: `${suffix.replace(/[^a-z0-9]+/gi, "-")}.png`,
    contentType: "image/png",
    contentBase64: TINY_PNG_BASE64,
  });
  mapping.set(id.toLowerCase(), { attachmentId: meta.id, fileName: meta.fileName });
}

let text = JSON.stringify(payload);
for (const [oldId, next] of mapping) text = text.replaceAll(oldId, next.attachmentId);
const cloned = JSON.parse(text);
for (const key of ["taskId", "propertyId", "poNumber", "id", "status", "submittedAtUtc", "updatedAtUtc"]) delete cloned[key];
cloned.inspectionConfirmed = true;

await apiOk(ahmed, "PUT", `/api/party-task-submissions/${taskId}`, { payload: cloned });
console.log(JSON.stringify({ poNumber: tx.poNumber, taskId, photos: mapping.size }));
