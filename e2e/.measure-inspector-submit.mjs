// Times the inspector «حفظ وإرسال» chain on a disposable transaction (API only, same calls the wizard makes).
// Run from the repo root with the stack up:  node e2e/.measure-inspector-submit.mjs
import {
  apiLogin,
  apiOk,
  createDistributedTransaction,
  uploadAttachment,
  TINY_PNG_BASE64,
  today,
} from "./fixtures/transaction.ts";

const PHOTOS = Number(process.env.PHOTOS ?? 30);
const ms = (t) => `${Math.round(performance.now() - t)} ms`;

const admin = await apiLogin("osama");
const tx = await createDistributedTransaction(admin);
const taskId = tx.fieldInspection.id;
if (!taskId) throw new Error(`no inspection task id in ${JSON.stringify(Object.keys(tx))}`);
const token = await apiLogin("ahmed");
console.log(`PO ${tx.poNumber} task ${taskId} photos ${PHOTOS}`);

const upload = async (scopeKey, name) => {
  const meta = await uploadAttachment(token, {
    scope: "field-inspection-photo",
    scopeKey: `${taskId}:${scopeKey}`,
    fileName: name,
    contentType: "image/png",
    contentBase64: TINY_PNG_BASE64,
  });
  return { attachmentId: meta.id, fileName: meta.fileName };
};

const featureKeys = ["facade", "buildState", "carEntrance", "kitchen"];
const featurePhotoAttachments = {};
for (const key of featureKeys) featurePhotoAttachments[key] = await upload(`feature:${key}`, `${key}.png`);

const freePhotos = [];
for (let i = 0; i < PHOTOS; i += 1) {
  const att = await upload(`free:${i + 1}`, `p${i + 1}.png`);
  freePhotos.push({ id: i + 1, ...att, kind: "exterior:service" });
}

const payload = {
  inspectionDate: today(),
  inspectionTime: "10:30",
  mapLatitude: "24.7136",
  mapLongitude: "46.6753",
  accessContactName: "ضابط اتصال آلي",
  accessContactPhone: "0555000111",
  accessContactRole: "مالك",
  accessContactNationalId: "1098765432",
  accessRouteDescription: "طريق مباشر من الشارع الرئيسي",
  inspectionConfirmed: true,
  featureValues: { assetSubject: "فيلا", facade: "شمالية", buildState: "جيد", carEntrance: "نعم", kitchen: "نعم" },
  featurePhotoAttachments,
  propertyDescription: "فيلا سكنية من دورين وملحق",
  deedMatchesNature: "yes",
  boundaryMatches: { north: { matches: true }, south: { matches: true }, east: { matches: true }, west: { matches: true } },
  observations: [],
  services: [],
  amenities: [],
  definedPhotos: {},
  freePhotos,
};

const path = `/api/party-task-submissions/${taskId}`;
const bytes = Buffer.byteLength(JSON.stringify({ payload }));
console.log(`draft payload ${Math.round(bytes / 1024)} KB`);

let t = performance.now();
await apiOk(token, "PUT", path, { payload });
console.log(`1) PUT whole draft          ${ms(t)}`);

t = performance.now();
await apiOk(token, "PUT", path, { payload: { ...payload, keyAvailable: false, clientDeclarationSigned: false } });
console.log(`2) PUT draft again (patch)  ${ms(t)}`);

t = performance.now();
await apiOk(token, "POST", `${path}/submit`);
console.log(`3) POST submit              ${ms(t)}`);
