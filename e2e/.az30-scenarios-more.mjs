// Scenarios 13–30 of the A→Z campaign: returns / rejections, failures (تعذّرات), special cases.
// Each one copies a type scenario of e2e/.az30-scenarios.mjs (values scaled) and adds hooks.
import fs from "node:fs";

const c = (type, prices, areas, extra = {}) => prices.map((price, i) => ({ type, price, area: areas[i], ...extra }));

export function addMore(SCENARIOS) {
  /** A copy of a type scenario under a new tag, comparable prices scaled by `f` so the values vary. */
  function like(src, tag, o) {
    const s = SCENARIOS[src];
    const n = Number(tag);
    const scale = (list) => list?.map((x) => ({ ...x, price: Math.round(x.price * o.f / 1000) * 1000 }));
    const V = structuredClone(s.valuation);
    if (V.market) V.market.comps = scale(V.market.comps);
    if (V.cost?.landComps) V.cost.landComps = scale(V.cost.landComps);
    const { f, valuation, ...rest } = o;
    return { ...s, tag, lat: 24.70 + n * 0.007, lng: 46.60 + n * 0.006, age: 6 + (n % 10), restrictions: n % 2 === 1, hooks: undefined, valuedDocument: undefined, ...rest, valuation: { ...V, ...(valuation ?? {}) } };
  }
  const msgOf = (r) => { const e = r?.errors ? Object.values(r.errors).flat().join(" | ") : ""; return e || r?.detail || r?.message || r?.title || JSON.stringify(r).slice(0, 300); };
  /** A call that must be refused: records the Arabic message; a 2xx is a finding. */
  async function refused(R, label, user, method, path, body, { headers } = {}) {
    const r = await R.call(user, method, path, body, { allow: [400, 403, 409, 422], headers });
    if (r && r.__status) {
      const msg = msgOf(r);
      R.S.refusals = [...(R.S.refusals ?? []), { label, status: r.__status, msg }];
      R.log(`  ✓ refused as expected (${label}) ${r.__status}: ${msg}`);
      R.save();
      return msg;
    }
    R.finding({ kind: "defect?", step: label, title: `expected a refusal but the server accepted: ${label}`, evidence: `${method} ${path}` });
    return null;
  }
  const failureBody = (R, p, type, title, role, text, severity = "internal") => ({
    poNumber: R.S.po, propertyId: p.id, deedNumber: p.deed, problemTypeId: type, severity, raisedByRole: role, title, internalNote: text, specialist: "أسامة الصالحي",
  });
  const note = (s) => ({ note: s });
  const DIST = { governmentAuditor: false, governmentAuditorId: "", valuationDepartment: true, operationsCoordinatorId: "", inspectorId: "fi-ahmed", valuatorId: "val-abdullah", engineeringOffice: true, engineeringOfficeId: "eo-jeddah", caseSpecialist: true, caseSpecialistId: "cs-osama" };
  const NAMES = { "field-inspection": "أحمد سعيد", "engineering-survey": "مكتب جدة للمساحة", "property-appraisal": "عبدالله الكثيري" };
  const ts = (R) => `/api/work-orders/${R.S.workOrderId}/properties/${R.S.propertyId}/transaction-state`;

  Object.assign(SCENARIOS, {
    // ── returns / rejections ──────────────────────────────────────────────────────────────────
    "13": like("04", "13", {
      name: "return-inspection", title: "فيلا — إعادة المعاينة للمعاين ثم التصحيح وإعادة الإرسال", f: 1.04, movables: false, district: "الياسمين",
      valuation: { basis: "market", premise: "hau", liq: 0 },
      expectInReport: ["وصف مصحح بعد الإعادة 13"], expectTimeline: ["أُعيد|إعادة|للتصحيح"],
      hooks: {
        async afterAccept(R) {
          const p = R.S.props[0];
          R.S.returnImpact = await R.call("osama", "GET", `/api/party-task-submissions/${p.inspection}/return-impact?sections=narrative,boundaries`);
          await R.call("osama", "POST", `/api/party-task-submissions/${p.inspection}/return-inspection`, {
            returnNote: "صحّح وصف العقار وطول الحد الشرقي — 13", sections: ["narrative", "boundaries"], affectedTaskIds: [], studyReport: null,
          });
          const cur = await R.call("ahmed", "GET", `/api/party-task-submissions/${p.inspection}`);
          R.log(`  inspector sees status=${cur.status} returnNote=${cur.returnNote ?? cur.payload?.returnNote} photos kept=${cur.payload?.freePhotos?.length}`);
          if (!cur.payload?.freePhotos?.length || !cur.payload?.propertyDescription) R.finding({ kind: "defect", step: "return-inspection", title: "returned inspection lost its earlier data", evidence: JSON.stringify(cur).slice(0, 300) });
          const b = cur.payload.boundaryMatches;
          await R.call("ahmed", "PUT", `/api/party-task-submissions/${p.inspection}`, { payload: {
            ...cur.payload, inspectionConfirmed: true, clientDeclarationSigned: true, declarationPhoneSatisfied: true, propertyDescription: "فيلا دورين وملحق — وصف مصحح بعد الإعادة 13",
            boundaryMatches: { ...b, east: { ...b.east, deedDesc: "قطعة 310 (معاين مصحح 13)", deedLength: "24.8" } },
          } });
          await R.call("ahmed", "POST", `/api/party-task-submissions/${p.inspection}/submit`);
          await R.call("osama", "POST", `/api/party-task-submissions/${p.inspection}/accept`);
          const wo = await R.call("osama", "GET", `/api/work-orders/${encodeURIComponent(R.S.po)}`, undefined, { quiet: true });
          const prop = wo.properties.find((x) => x.id === p.id);
          R.log(`  property east boundary after re-accept: ${prop.eastBoundary} / ${prop.eastBoundaryLengthM}`);
          if (!String(prop.eastBoundary ?? "").includes("مصحح")) R.finding({ kind: "defect?", step: "return-inspection", title: "corrected inspector east boundary not mirrored onto the property after re-accept", evidence: `eastBoundary=${prop.eastBoundary}` });
        },
      },
    }),
    "14": like("01", "14", {
      name: "return-survey", title: "أرض سكنية — إعادة الرفع المساحي للمكتب ثم إعادة الإرسال", f: 0.93, area: 820, district: "الملقا",
      valuation: { market: { subjectArea: 820, basis: "price_per_sqm", comps: c("أرض", [2400000, 2550000, 2480000], [800, 850, 830]) } },
      expectInReport: ["مكتب مصحح 14"], expectTimeline: ["أُعيد|إعادة|للتصحيح"],
      hooks: {
        async afterSurvey(R) {
          const p = R.S.props[0];
          await R.call("osama", "POST", `/api/party-task-submissions/${p.survey}/reopen`, { returnNote: "الحد الشرقي في الكروكي لا يطابق الطبيعة — صحّحه" });
          const cur = await R.call("jeddah_survey", "GET", `/api/party-task-submissions/${p.survey}`);
          R.log(`  office sees status=${cur.status}`);
          await R.call("jeddah_survey", "PUT", `/api/party-task-submissions/${p.survey}`, { payload: { ...cur.payload, siteConfirmed: true, declarationPhoneSatisfied: true, eastBoundary: "قطعة 310 (مكتب مصحح 14)", eastBoundaryLengthM: "33.2" } });
          await R.call("jeddah_survey", "POST", `/api/party-task-submissions/${p.survey}/submit`);
          await R.call("osama", "POST", `/api/party-task-submissions/${p.survey}/accept`);
        },
      },
    }),
    "15": like("06", "15", {
      name: "return-appraisal", title: "عمارة — إعادة حزمة المقيّم للتصحيح ثم إعادة التسليم", f: 1.06, district: "العليا",
      hooks: {
        async afterSubmit(R, X, L) {
          const before = R.S.finalValue;
          await refused(R, "reopen without a return note", "osama", "POST", `/api/party-task-submissions/${R.S.appraisal}/reopen`, { returnNote: "" });
          await R.call("osama", "POST", `/api/party-task-submissions/${R.S.appraisal}/reopen`, { returnNote: "رجّح أسلوب التكلفة أكثر — العمارة حديثة — 15" });
          X.valuation.weights = [30, 70];
          await L.reconcile(R, X);
          await L.appraisalPackage(R, X);
          R.log(`  value before return ${before} → after correction ${R.S.finalValue}`);
          if (before === R.S.finalValue) R.finding({ kind: "check", step: "return-appraisal", title: "value unchanged after the corrected weights", evidence: `${before}` });
        },
      },
    }),
    "16": like("04", "16", {
      name: "withdraw-draft-deed-mismatch", title: "فيلا — المعاين «غير مطابق» + الأخصائي يسحب المسودة ويعيد إرسالها", f: 0.97, district: "حطين", movables: false,
      inspectorDeedMatch: "no", valuation: { basis: "market", premise: "hau" },
      studyOutcome: "matched", studyOutcomeNotes: "تحقق الأخصائي من المخطط المعتمد: الحد الشرقي مطابق للصك — 16",
      hooks: {
        async study(R, X, L) {
          const r = await L.issueStudy(R, { ...X, studyOutcomeNotes: "" }, { allow: [400] });
          if (r?.__status) {
            const m = msgOf(r);
            R.S.refusals = [...(R.S.refusals ?? []), { label: "matched over inspector's no without reason", status: r.__status, msg: m }];
            R.log(`  ✓ refused: ${m}`);
            await L.issueStudy(R, X);
          } else {
            R.finding({ kind: "defect", step: "study", title: "«مطابق» against the inspector's «غير مطابق» issued without a reason" });
          }
        },
        async afterSend(R) {
          await R.call("osama", "POST", `/api/valuation-requests/${R.S.vr}/report-draft/withdraw`, note("سحبت المسودة لمراجعة الحد الشرقي — 16"));
          const d = await R.call("osama", "GET", `/api/valuation-requests/${R.S.vr}/report-draft`);
          R.log(`  draft after withdraw: status=${d.status}`);
          await refused(R, "send without conformity", "osama", "POST", `/api/valuation-requests/${R.S.vr}/report-draft/send`, { conformityConfirmed: false, note: "x" });
          await R.call("osama", "POST", `/api/valuation-requests/${R.S.vr}/report-draft/send`, { conformityConfirmed: true, note: "أعدت الإرسال بعد المراجعة — 16" });
        },
      },
    }),
    "17": like("05", "17", {
      name: "withdraw-approval", title: "شقة — المقيّم يسحب اعتماده قبل الإيداع ثم يعتمد من جديد", f: 1.05, district: "الربيع",
      hooks: {
        async afterApprove(R, X, L) {
          await R.call("abdullah", "POST", `/api/valuation-requests/${R.S.vr}/report-draft/withdraw-approval`, note("أراجع حصة الأرض قبل الإيداع — 17"));
          const d = await R.call("abdullah", "GET", `/api/valuation-requests/${R.S.vr}/report-draft`);
          R.log(`  draft after withdraw-approval: status=${d.status} stage=${d.reportStage}`);
          await R.call("osama", "POST", `/api/party-task-submissions/${R.S.appraisal}/reopen`, { returnNote: "عدّل الترجيح بعد سحب الاعتماد — 17" }, { allow: [400] });
          X.valuation.weights = [60, 40];
          await L.reconcile(R, X);
          await L.appraisalPackage(R, X);
          await L.sendDraft(R, X, "أعدت الإرسال بعد سحب الاعتماد — 17");
          await L.approveInUi(R);
        },
      },
    }),
    "18": like("09", "18", {
      name: "study-reopen", title: "مستودع — إعادة فتح تقرير دراسة الحالة بعد إصداره", f: 1, area: 2400, district: "المصانع",
      valuation: { cost: { unitCost: 950, profit: 13, life: 35 } },
      expectTimeline: ["إعادة فتح|أُعيد فتح|أعيد فتح"],
      hooks: {
        async afterSubmit(R, X, L) {
          await refused(R, "study reopen with short reason", "osama", "POST", `/api/case-study-reports/${R.S.parent}/reopen`, { reason: "قصير", clearEnfazHandover: false });
          const r = await R.call("osama", "POST", `/api/case-study-reports/${R.S.parent}/reopen`, { reason: "تصحيح ملاحظات المطابقة بعد مراجعة المخطط — 18", clearEnfazHandover: false });
          R.log(`  reopen → appraiserSubmitted=${r.appraiserSubmitted} report status=${r.report?.status}`);
          const pkg = await R.call("abdullah", "GET", `/api/party-task-submissions/${R.S.appraisal}`);
          R.log(`  appraiser package after study reopen: ${pkg.status}`);
          await L.issueStudy(R, { ...X, studyOutcome: "differences", studyOutcomeNotes: "فروق طفيفة في طول الحد الغربي (0.2 م) — 18" });
        },
      },
    }),
    "19": like("02", "19", {
      name: "deposit-code-correction", title: "أرض تجارية — تصحيح رمز الإيداع بعد الإصدار النهائي", f: 1.08, district: "الصحافة",
      hooks: {
        async afterFinal(R) {
          const old = R.S.depositCode;
          const prev = `${R.OUT}/../04-villa/state.json`;
          const other = fs.existsSync(prev) ? JSON.parse(fs.readFileSync(prev, "utf8")).depositCode : null;
          if (other) await refused(R, "deposit code already used on another report", "osama", "POST", `/api/valuation-requests/${R.S.vr}/report-issuance/certificate`, { depositCode: other });
          R.S.depositCode = `QMC${Date.now().toString().slice(-8)}`;
          await R.call("osama", "POST", `/api/valuation-requests/${R.S.vr}/report-issuance/certificate`, { depositCode: R.S.depositCode });
          R.log(`  deposit code corrected ${old} → ${R.S.depositCode}`);
          await new Promise((r) => setTimeout(r, 20000));
          await R.finalChecks("final-corrected");
          const txt = fs.readFileSync(`${R.OUT}/final-corrected-pdf.txt`, "utf8");
          if (txt.includes(old)) R.finding({ kind: "defect", step: "deposit-code-correction", title: "final PDF still carries the old deposit code after correction", evidence: `${R.OUT}/final-corrected-pdf.txt` });
        },
      },
    }),
    "20": like("04", "20", {
      name: "enfaz-return", title: "فيلا — إعادة من إنفاذ (فتح الدراسة) ثم إعادة الرفع", f: 1.1, district: "الواحة", movables: false,
      valuation: { basis: "liquidation", premise: "orderly", liq: 15 },
      expectTimeline: ["إنفاذ"],
      hooks: {
        async afterHandover(R, X, L) {
          await refused(R, "enfaz return with short reason", "osama", "POST", `${ts(R)}/enfaz-return`, { reason: "قصير", reopenStudy: true, reopenValuation: false });
          const st = await R.call("osama", "POST", `${ts(R)}/enfaz-return`, { reason: "إنفاذ طلب تصحيح وصف الحدود في الدراسة — 20", reopenStudy: true, reopenValuation: false });
          R.log(`  enfaz-return notices: ${JSON.stringify(st.enfazReturnNoticesAr)} handover=${st.enfazHandoverAtUtc}`);
          await refused(R, "re-handover while the study is reopened", "osama", "POST", `${ts(R)}/enfaz-handover`);
          await L.issueStudy(R, { ...X, studyOutcome: "matched", studyOutcomeNotes: "" });
          await L.handover(R);
        },
      },
    }),
    "21": like("04", "21", {
      name: "report-version-2", title: "منزل — فتح التقرير بنسخة جديدة (ن+1) بعد الإيداع", typeAr: "منزل", f: 0.8, district: "الروضة", movables: false,
      valuation: { basis: "market", premise: "hau" },
      hooks: {
        async afterFinal(R, X, L) {
          const v1 = { value: R.S.finalValue, code: R.S.depositCode };
          await refused(R, "reopen version with empty reason", "osama", "POST", `/api/valuation-requests/${R.S.vr}/report-issuance/reopen`, { reason: "" });
          const r = await R.call("osama", "POST", `/api/valuation-requests/${R.S.vr}/report-issuance/reopen`, { reason: "خطأ في ترجيح الأساليب — نسخة جديدة — 21" });
          R.log(`  reopen → version ${r.version} stage ${r.stage} superseded ${r.supersededCount}`);
          const pkg = await R.call("abdullah", "GET", `/api/party-task-submissions/${R.S.appraisal}`);
          R.log(`  appraiser package after reopen: ${pkg.status}`);
          X.valuation.weights = [75, 25];
          await L.reconcile(R, X);
          await L.appraisalPackage(R, X);
          await L.dumpReport(R, X, "report-v2");
          await L.sendDraft(R, X, "النسخة الثانية بعد تعديل الترجيح — 21");
          await L.approveInUi(R);
          await refused(R, "deposit v2 with the v1 code", "osama", "POST", `/api/valuation-requests/${R.S.vr}/report-issuance/certificate`, { depositCode: v1.code, certificateFileName: "c.pdf", certificateContentType: "application/pdf", certificateContentBase64: L.PDF });
          await L.deposit(R, X);
          await R.finalChecks("final-v2");
          R.S.v1 = v1;
          if (R.S.draftVersion !== 2) R.finding({ kind: "defect?", step: "report-version", title: `draft version after reopen is ${R.S.draftVersion}, expected 2` });
        },
      },
    }),
    "22": like("01", "22", {
      name: "cancellation", title: "أرض سكنية — طلب إلغاء يرفضه المشرف، ثم طلب يُعتمد ثم إعادة تفعيل وإكمال", f: 1.12, area: 640, district: "القيروان",
      valuation: { market: { subjectArea: 640, basis: "price_per_sqm", comps: c("أرض", [2000000, 2150000, 2080000], [620, 660, 650]) } },
      expectTimeline: ["إلغاء"],
      hooks: {
        async afterAccept(R, X, L) {
          const pid = R.S.propertyId;
          const pv = await R.call("osama", "GET", `/api/transaction-cancellations/preview?propertyId=${pid}`);
          R.log(`  preview: deeds=${pv.deeds?.length} excluded=${pv.excluded?.length}`);
          await refused(R, "cancel request without note", "osama", "POST", "/api/transaction-cancellations", { propertyId: pid, reasonCode: "duplicate", note: "" });
          const a = await R.call("osama", "POST", "/api/transaction-cancellations", { propertyId: pid, reasonCode: "duplicate", note: "يبدو أنها مكررة مع معاملة أخرى — 22" });
          await refused(R, "specialist approves his own cancellation", "osama", "POST", `/api/transaction-cancellations/${a.id}/approve`, note(""));
          await R.call("sliman", "POST", `/api/transaction-cancellations/${a.id}/reject`, note("ليست مكررة — أكمل العمل"));
          const b = await R.call("osama", "POST", "/api/transaction-cancellations", { propertyId: pid, reasonCode: "other", note: "طلب إنفاذ إيقاف المعاملة مؤقتاً — 22" });
          await R.call("sliman", "POST", `/api/transaction-cancellations/${b.id}/approve`, note("معتمد"));
          const st = await R.call("osama", "GET", `/api/transaction-cancellations/by-property/${pid}`);
          R.log(`  after approve: ${JSON.stringify(st).slice(0, 200)}`);
          const tasks = await R.call("osama", "GET", `/api/workflow-tasks?poNumber=${encodeURIComponent(R.S.po)}`, undefined, { quiet: true });
          R.log(`  tasks after cancel: ${tasks.map((t) => `${t.kind}:${t.status}`).join(", ")}`);
          await refused(R, "office saves on a cancelled transaction", "jeddah_survey", "PUT", `/api/party-task-submissions/${R.S.survey}`, { payload: { surveyNotes: "x" } });
          await refused(R, "reactivate without note", "sliman", "POST", `/api/transaction-cancellations/${b.id}/reactivate`, note(""));
          await R.call("sliman", "POST", `/api/transaction-cancellations/${b.id}/reactivate`, note("أُعيد تفعيلها بطلب إنفاذ — 22"));
          const after = await L.readTasks(R);
          R.log(`  tasks after reactivate: ${after.map((t) => `${t.kind}:${t.status}`).join(", ")}`);
        },
      },
    }),

    // ── failures (تعذّرات) ─────────────────────────────────────────────────────────────────────
    "23": like("01", "23", {
      name: "failure-bourse", title: "أرض سكنية — متعذّر في البورصة ثم حُلّ", f: 0.88, area: 900, district: "العارض",
      valuation: { market: { subjectArea: 900, basis: "price_per_sqm", comps: c("أرض", [2350000, 2500000, 2420000], [880, 930, 910]) } },
      expectTimeline: ["تعذّر|تعذر"],
      hooks: {
        async afterBourse(R, X, L) {
          const p = R.S.props[0];
          await R.call("osama", "PUT", `/api/work-orders/${encodeURIComponent(R.S.po)}/properties/${p.id}/bourse`, { ...L.bourseBody(X), deedStatus: "غير فعال" });
          const f = await R.call("osama", "POST", "/api/failures", failureBody(R, p, "deed-inactive", "متعذّر — الصك غير فعال", "الأخصائي", "البورصة تُظهر الصك غير فعال — 23"));
          R.S.failureId = f.id;
          await R.call("osama", "POST", `/api/workflow-tasks/${p.parent}/advance-after-bourse`, { deedNumber: p.deed }, { allow: [400] });
          await refused(R, "distribution while a failure is open", "osama", "POST", `/api/workflow-tasks/${p.parent}/confirm-distribution`, { deedNumber: p.deed, distribution: DIST, assigneeNames: NAMES });
          await R.call("osama", "POST", `/api/failures/${f.id}/submit`, note("الصك غير فعال في البورصة — أرجو التوجيه"));
          await R.call("sliman", "POST", `/api/failures/${f.id}/return`, note("راجع البورصة مرة أخرى قبل الاعتماد"));
          await R.call("osama", "POST", `/api/failures/${f.id}/resolve`, { resolutionReason: "أصبح الصك فعالاً بعد مراجعة البورصة", continueInstructions: "أكمل التوزيع" });
          await R.call("osama", "PUT", `/api/work-orders/${encodeURIComponent(R.S.po)}/properties/${p.id}/bourse`, L.bourseBody(X));
          const active = await R.call("osama", "GET", `/api/failures/property?poNumber=${encodeURIComponent(R.S.po)}&propertyId=${p.id}`);
          R.log(`  active failure after resolve: ${JSON.stringify(active).slice(0, 120)}`);
        },
      },
    }),
    "24": like("04", "24", {
      name: "failure-access", title: "فيلا — المعاين لا يستطيع الدخول (تعذّر) ثم حُلّ", f: 1.02, district: "المروج", movables: true,
      valuation: { basis: "liquidation", premise: "orderly", liq: 12 },
      expectTimeline: ["تعذّر|تعذر"],
      hooks: {
        async inspector(R, X, L) {
          const p = R.S.props[0];
          const f = await R.call("ahmed", "POST", "/api/failures", failureBody(R, p, "access-denied", "عدم تمكين دخول العقار", "المعاين", "رفض الساكن دخول العقار بدون محضر تمكين — 24"), { headers: { "Idempotency-Key": `az30-24-${p.id}` } });
          R.S.failureId = f.id;
          await R.call("osama", "POST", `/api/failures/${f.id}/submit`, note("الساكن يرفض الدخول — نحتاج محضر تمكين"));
          await R.call("sliman", "POST", `/api/failures/${f.id}/return`, note("نسّق مع الشرطة وأعد المحاولة"));
          await R.call("osama", "POST", `/api/failures/${f.id}/resolve`, { resolutionReason: "تم الدخول بمحضر تمكين مع الشرطة", continueInstructions: "يكمل المعاين المعاينة" });
          await L.inspector(R, X);
        },
      },
    }),
    "25": like("01", "25", {
      name: "failure-survey-pin", title: "أرض سكنية — اختلاف موقع المكتب عن المعاين → تجميد → فك → إكمال", f: 1.01, area: 700, district: "الرمال",
      valuation: { market: { subjectArea: 700, basis: "price_per_sqm", comps: c("أرض", [1700000, 1820000, 1760000], [680, 720, 710]) } },
      expectTimeline: ["تجميد|التجميد"],
      hooks: {
        async survey(R, X, L) {
          const p = R.S.props[0];
          const cur = await R.call("jeddah_survey", "GET", `/api/party-task-submissions/${p.survey}`);
          const report = await R.call("jeddah_survey", "POST", "/api/attachments", { scope: "engineering-survey-report", scopeKey: p.survey, fileName: "survey-report.pdf", contentType: "application/pdf", contentBase64: L.PDF });
          const letter = await R.call("jeddah_survey", "POST", "/api/attachments", { scope: "engineering-site-letter", scopeKey: p.survey, fileName: "site-letter.pdf", contentType: "application/pdf", contentBase64: L.PDF });
          const far = { lat: X.lat + 0.011, lng: X.lng };
          await R.call("jeddah_survey", "PUT", `/api/party-task-submissions/${p.survey}`, { payload: L.surveyPayload(X, cur, p, report, letter, far, R.S.po) });
          await R.call("jeddah_survey", "POST", `/api/party-task-submissions/${p.survey}/submit`);
          const f = await R.call("jeddah_survey", "POST", "/api/failures", failureBody(R, p, "unknown-location", "اختلاف موقع المعاين عن المكتب الهندسي", "المكتب الهندسي",
            `اختلاف موقع المعاين عن المكتب الهندسي (≈1220 م). المعاين: ${X.lat.toFixed(5)}, ${X.lng.toFixed(5)}. المكتب: ${far.lat.toFixed(5)}, ${far.lng.toFixed(5)}.`), { headers: { "Idempotency-Key": `pin-mismatch:${p.id}` } });
          R.S.failureId = f.id;
          await R.call("osama", "POST", `/api/party-task-submissions/${p.survey}/reopen`, { returnNote: "موقع الرفع بعيد عن موقع المعاين — صحّحه" });
          const cur2 = await R.call("jeddah_survey", "GET", `/api/party-task-submissions/${p.survey}`);
          await R.call("jeddah_survey", "PUT", `/api/party-task-submissions/${p.survey}`, { payload: { ...cur2.payload, siteConfirmed: true, declarationPhoneSatisfied: true, latitude: (X.lat + 0.00005).toFixed(6), longitude: (X.lng + 0.00005).toFixed(6) } });
          await refused(R, "survey submit while frozen", "jeddah_survey", "POST", `/api/party-task-submissions/${p.survey}/submit`);
          await refused(R, "supervisor lifts the survey freeze", "sliman", "POST", "/api/failures/by-property/lift-survey-freeze", { poNumber: R.S.po, propertyId: p.id, reason: "المكتب صحّح الموقع ميدانياً" });
          const lift = await R.call("osama", "POST", "/api/failures/by-property/lift-survey-freeze", { poNumber: R.S.po, propertyId: p.id, reason: "المكتب صحّح الموقع ميدانياً — 25" });
          R.log(`  lifted: ${JSON.stringify(lift)}`);
          await R.call("jeddah_survey", "POST", `/api/party-task-submissions/${p.survey}/submit`);
          await R.call("osama", "POST", `/api/party-task-submissions/${p.survey}/accept`);
          R.S.failureToResolveBeforeStudy = f.id;
        },
        async afterSurvey(R, X, L) {
          await refused(R, "formal receipt while the location failure is open", "osama", "POST", `/api/transactions/by-property/${R.S.propertyId}/receive`, {});
          await refused(R, "study issue while the location failure is open", "osama", "POST", `/api/case-study-reports/${R.S.parent}/issue`, { report: { taskId: R.S.parent, propertyId: R.S.propertyId, poNumber: R.S.po, deedNatureMatchOutcome: "matched", deedNatureMatchNotes: "", answers: {} } });
          await R.call("osama", "POST", `/api/failures/${R.S.failureId}/resolve`, { resolutionReason: "تطابق الموقعان بعد تصحيح المكتب", continueInstructions: "أكمل الدراسة" });
        },
      },
    }),
    "26": like("06", "26", {
      name: "failure-supervisor-resolves", title: "عمارة — تعذّر يصعّده الأخصائي ويحله المشرف", f: 0.92, district: "الملز",
      expectTimeline: ["تعذّر|تعذر"],
      hooks: {
        async afterAccept(R) {
          const p = R.S.props[0];
          const f = await R.call("osama", "POST", "/api/failures", failureBody(R, p, "party-uncooperative", "عدم تعاون أحد أطراف التنفيذ", "الأخصائي", "وكيل المالك لا يرد على الاتصالات — 26"));
          R.S.failureId = f.id;
          await R.call("osama", "POST", `/api/failures/${f.id}/submit`, note("أرجو تدخل المشرف للتواصل مع الوكيل"));
          await R.call("sliman", "POST", `/api/failures/${f.id}/resolve`, { resolutionReason: "تواصل المشرف مع الوكيل وتم التعاون", continueInstructions: "أكمل الرفع المساحي" });
          const all = await R.call("sliman", "GET", `/api/failures?poNumber=${encodeURIComponent(R.S.po)}`);
          const mine = (Array.isArray(all) ? all : all.items ?? []).find((x) => x.id === f.id);
          R.log(`  failure status after supervisor resolve: ${mine?.status} reason=${mine?.resolutionReason}`);
        },
      },
    }),
    "27": like("04", "27", {
      name: "failure-late-then-complete", title: "فيلا — تعذّر يرفعه المقيّم بعد التسليم ثم يُحل وتكتمل المعاملة", f: 0.95, district: "النخيل", movables: true,
      valuation: { basis: "market", premise: "hau" },
      hooks: {
        async afterSubmit(R) {
          const p = R.S.props[0];
          const f = await R.call("abdullah", "POST", "/api/failures", failureBody(R, p, "movables-present", "وجود منقولات في العقار", "المقيم", "منقولات ثمينة لم تُحصر — 27", "suspected"));
          R.S.failureId = f.id;
          await R.call("osama", "POST", `/api/failures/${f.id}/upgrade`);
        },
        async afterFinal(R) {
          await refused(R, "Enfaz handover while a failure is open", "osama", "POST", `${ts(R)}/enfaz-handover`);
          await R.call("osama", "POST", `/api/failures/${R.S.failureId}/resolve`, { resolutionReason: "حُصرت المنقولات وأضيفت لملف المعاملة", continueInstructions: "ارفع على إنفاذ" });
        },
      },
    }),

    // ── special ─────────────────────────────────────────────────────────────────────────────
    "28": like("06", "28", {
      name: "linked-deeds", title: "عمارة على صكين مرتبطين (مبنى واحد) في معاملة واحدة", f: 1.03, deeds: 2, area: 450, district: "السليمانية",
      hooks: {
        async afterBourse(R) {
          const [a, b] = R.S.props;
          const tx = await R.call("osama", "GET", `/api/transactions/by-property/${a.id}`);
          R.S.transactionId = tx.id ?? tx.transactionId;
          await refused(R, "merge with a short reason", "osama", "POST", `/api/transactions/${R.S.transactionId}/merge`, { propertyIds: [b.id], linkKind: "one_building", reason: "x" });
          const m = await R.call("osama", "POST", `/api/transactions/${R.S.transactionId}/merge`, { propertyIds: [b.id], linkKind: "one_building", reason: "مبنى واحد قائم على صكين متجاورين — 28" });
          R.log(`  merged: ${JSON.stringify(m).slice(0, 300)}`);
        },
      },
    }),
    "29": like("04", "29", {
      name: "platted-no-office", title: "فيلا على صك مخطط (قطعة ومخطط) بلا مكتب هندسي", f: 1.07, platted: true, district: "الندى", movables: false,
      valuation: { basis: "market", premise: "hau" },
      hooks: {
        async afterDistribute(R) {
          if (R.S.survey) R.finding({ kind: "defect", step: "distribute", title: "platted deed got an engineering-survey task" });
          await refused(R, "add an office to a platted deed", "osama", "POST", `/api/workflow-tasks/${R.S.parent}/engineering-survey`, { assigneeId: "eo-jeddah", assigneeName: "مكتب جدة للمساحة" });
        },
      },
    }),
    "30": like("01", "30", {
      name: "boundaries-unavailable", title: "أرض سكنية — حدود البورصة «غير متوفرة» والمعاين يكتبها", f: 0.9, boundaries: "no", area: 600, district: "المونسية",
      valuation: { market: { subjectArea: 600, basis: "price_per_sqm", comps: c("أرض", [1500000, 1620000, 1560000], [590, 630, 610]) } },
      hooks: {
        async afterAccept(R) {
          const wo = await R.call("osama", "GET", `/api/work-orders/${encodeURIComponent(R.S.po)}`, undefined, { quiet: true });
          const prop = wo.properties.find((x) => x.id === R.S.propertyId);
          R.log(`  property boundaries after accept: N=${prop.northBoundary} (${prop.northBoundaryLengthM}) E=${prop.eastBoundary}`);
          if (!String(prop.northBoundary ?? "").includes("معاين")) R.finding({ kind: "defect?", step: "accept", title: "inspector-typed boundaries (bourse «غير متوفرة») not mirrored onto the property", evidence: `northBoundary=${prop.northBoundary}` });
        },
      },
    }),
  });
}
