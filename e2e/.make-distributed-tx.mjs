// Creates a disposable transaction distributed to the inspector and the appraiser; prints its ids.
// BOUNDARIES=no marks the bourse boundaries «غير متوفرة» before distribution.
// Run from the repo root with the stack up:  npx tsx e2e/.make-distributed-tx.mjs
import { apiLogin, apiOk, createDistributedTransaction } from "./fixtures/transaction.ts";

const token = await apiLogin("osama");
const tx = await createDistributedTransaction(token);
if (process.env.BOUNDARIES) {
  const order = await apiOk(token, "GET", `/api/work-orders/${encodeURIComponent(tx.poNumber)}`);
  const property = order.properties.find((p) => p.id === tx.propertyId);
  await apiOk(token, "PUT", `/api/work-orders/${encodeURIComponent(tx.poNumber)}/properties/${tx.propertyId}`, {
    ...property,
    boundariesAvailability: process.env.BOUNDARIES,
  });
}
console.log(JSON.stringify({ po: tx.poNumber, propertyId: tx.propertyId, inspection: tx.fieldInspection.id, appraisal: tx.propertyAppraisal.id }));
