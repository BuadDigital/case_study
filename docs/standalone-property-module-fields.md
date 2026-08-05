# Standalone property module — field catalog & persistence map

> **Purpose:** Extract the property / case-study domain as an **independent program** outside the full Ejada platform.  
> **Sources:** `packages/app-shared/src/prototype/property-fields-catalog.ts`, `backend/RealEstateEval.Domain/*`, party submission payloads.  
> **Generated for:** module boundary design, schema planning, Infath field alignment.  
> **Convention:** Frontend / API JSON = **camelCase**; PostgreSQL / EF columns = **PascalCase** (same name unless noted).

---

## 1. Persistence patterns

| Pattern | Where | How fields live |
|---------|--------|-----------------|
| **Normalized columns** | Work orders, properties, contacts, case-study meta, failures | One DB column per field |
| **JSON blob** | Party submissions (`PayloadJson`), case answers (`AnswersJson`), task distribution (`DistributionJson`) | Nested keys inside one column |
| **Projection / denorm** | `FieldInspectionWorkspaces` | Subset of inspection payload for reporting (payload remains source of truth) |
| **Display-only** | Property detail hero/basic, party panel | Derived in UI — do **not** invent columns unless product requires it |
| **Catalog alias vs storage key** | Infath labels vs form keys | e.g. `streetWidth` (catalog) → `streetWidthM` (payload) |

### Suggested standalone schemas

| Schema | Tables |
|--------|--------|
| `case_study` | WorkOrders, WorkOrderProperties, PropertyContacts, PoIntakeDrafts, WorkflowTasks, CaseStudyForms, PartyTaskSubmissions, FieldInspectionWorkspaces, InspectorFeeLedgers |
| `failures` | PropertyFailures |
| Optional later | Keys / envelopes / ops / finance / identity — **out of core property module** unless you explicitly include them |

### Party submission kinds (`PartyTaskSubmissions.Kind`)

| Kind | Frontend form | Storage |
|------|---------------|---------|
| `field-inspection` | Inspector workspace | `PayloadJson` (+ optional workspace projection) |
| `engineering-survey` | Engineering survey | `PayloadJson` |
| `property-appraisal` | Evaluator submission | `PayloadJson` |
| `government-review` | Government review | `PayloadJson` |

---

## 2. Module boundary (recommended)

### In scope (core property module)

- Work order + property intake + bourse
- Workflow tasks + distribution JSON
- Case study form (columns + `AnswersJson`)
- Party submissions (all kinds above)
- Failures (تعذر)
- Optional: inspector/engineering fee ledger if fees stay with the property lifecycle

### Out of scope (platform / other modules)

- Identity / HR / registration
- Operations tasks, key envelopes, court catalog engine
- Financial disbursement batches, Enfaz revenue lines
- Shell-only navigation / orphan admin screens
- Infath worker license fields (spec only — not implemented)

---

## 3. Core entities — column map

### 3.1 `case_study.WorkOrders`

| Frontend / API | DB column | Notes |
|----------------|-----------|-------|
| `poNumber` | `PoNumber` | |
| `assignmentType` | `AssignmentType` | enum |
| `promulgationDate` | `PromulgationDate` | `DateOnly` |
| `receivedFromEnfathAt` | `ReceivedFromEnfathAt` | |
| `receivedFromEnfathTime` | `ReceivedFromEnfathTime` | |
| `assignmentSpecialist` | `AssignmentSpecialist` | |
| `assignmentSpecialistEmail` | `AssignmentSpecialistEmail` | |
| `expectedPropertyCount` | `ExpectedPropertyCount` | |
| `dueDateAt` | `DueDateAt` | |
| `propertiesRegion` | `PropertiesRegion` | |
| `workOrderDescription` | `WorkOrderDescription` | |
| `lifecycleStatus` | `LifecycleStatus` | `cancelled` \| `stopped` |
| `createdAtUtc` | `CreatedAtUtc` | system |

### 3.2 `case_study.WorkOrderProperties`

| Frontend / API | DB column | Notes |
|----------------|-----------|-------|
| `id` | `Id` | Guid |
| `workOrderId` | `WorkOrderId` | FK |
| `identifierType` | `IdentifierType` | deed / registry |
| `deedNumber` | `DeedNumber` | |
| `requestNumber` | `RequestNumber` | |
| `assignmentMandateNumber` | `AssignmentMandateNumber` | |
| `assignmentMandateDate` | `AssignmentMandateDate` | `yyyy-MM-dd` string |
| `deedDate` | `DeedDate` | |
| `ownerName` | `OwnerName` | |
| `planNumber` | `PlanNumber` | |
| `plotNumber` | `PlotNumber` | |
| `locationMapUrl` | `LocationMapUrl` | |
| `court` / `circuit` | `Court` / `Circuit` | display copies |
| `courtId` / `circuitId` | `CourtId` / `CircuitId` | optional FKs |
| `assignmentDocFileNames` | `AssignmentDocFileName` | FE may be array; DB often single/JSON |
| `delegationLetterFileNames` | `DelegationLetterFileName` | same |
| `otherDocumentFileNames` | `OtherDocumentFileNames` | JSON array string |
| `realEstateRegFileName` | `RealEstateRegFileName` | |
| `city` / `district` | `City` / `District` | bourse |
| `classification` / `propertyType` | `Classification` / `PropertyType` | |
| `area` / `deedStatus` | `Area` / `DeedStatus` | |
| `restrictionsPresent` | `RestrictionsPresent` | yes/no |
| `restrictionType` | `RestrictionType` | mortgaged/seized/suspended/other |
| `restrictionOtherReason` | `RestrictionOtherReason` | |
| `boundariesAvailability` | `BoundariesAvailability` | deed/bourse/doc/no |
| `boundariesExternalDocName` | `BoundariesExternalDocName` | |
| `northBoundary` (+ `northBoundaryLengthM`) | `NorthBoundary`, `NorthBoundaryLengthM` | same for S/E/W |
| `bourseDataCompleted` | `BourseDataCompleted` | |
| `bourseCompletedAtUtc` | `BourseCompletedAtUtc` | |
| `isRemoved` / `removalReason` | `IsRemoved` / `RemovalReason` / `RemovedAtUtc` | soft delete |

### 3.3 `case_study.PropertyContacts`

| Frontend | DB column |
|----------|-----------|
| `contacts[].name` | `Name` |
| `contacts[].role` | `Role` |
| `contacts[].phone` | `Phone` |
| — | `PropertyId`, `SortOrder` |

### 3.4 `case_study.PoIntakeDrafts`

| Frontend | DB |
|----------|-----|
| Wizard draft state | `DraftJson` (opaque) |

### 3.5 `case_study.WorkflowTasks`

| Frontend | DB column | Notes |
|----------|-----------|-------|
| `id` | `Id` | |
| `kind` | `Kind` | see kinds above + `case-study-property` parent |
| `poNumber` | `PoNumber` | |
| `propertyId` | `PropertyId` | |
| `propertyOrdinal` | `PropertyOrdinal` | |
| `title` | `Title` | |
| `phase` / `status` | `Phase` / `Status` | |
| `assigneeRole` / `assigneeName` / `assigneeId` | matching | |
| `parentTaskId` | `ParentTaskId` | |
| `distribution.*` | `DistributionJson` | nested assignees |
| `obstructionReason` | `ObstructionReason` | |
| `obstructionPriorPhase` | `ObstructionPriorPhase` | |
| `assignmentType` | `AssignmentType` | |

### 3.6 `case_study.CaseStudyForms`

| Frontend | DB column | Notes |
|----------|-----------|-------|
| `taskId` | `TaskId` | |
| `isPartyForm` | `IsPartyForm` | |
| `propertyId` / `poNumber` | matching | |
| `status` / `currentStep` | `Status` / `CurrentStep` | new/draft/submitted |
| `requestNumber` / `requestDate` / `deedNumber` | matching | |
| **`answers`** | **`AnswersJson`** | map of question keys → values |
| `deedRemarks` / `surveyRemarks` / `componentsRemarks` / `occupancyRemarks` | matching | |
| `meterType` / `meterNumber` / `hoaFee` | matching | |
| `sigDeed` / `sigApprover` / `sigDate` | matching | |
| `specialistReviewApproved` | `SpecialistReviewApprovedJson` | questionKey → bool |
| `infathLinkedAssets` | `InfathLinkedAssets` | catalog alias: `linkedAssets` |
| `infathLinkedDeedNumbers` | `InfathLinkedDeedNumbers` | alias: `linkedDeedNumbers` |
| `infathLinkedAssetsNotes` / `infathOtherNotes` / `infathClosingNotes` | matching | aliases: `linkedAssetsNotes`, `otherNotes`, `closingNotes` |
| `savedAtUtc` | `SavedAtUtc` | |

**`AnswersJson` keys:** `deed_0`…`deed_10`, `survey_0`…`survey_6`, `comp_0`…`comp_8`, `occ_0`…`occ_5`, `extra_0`…`extra_3`.

### 3.7 `case_study.PartyTaskSubmissions`

| Frontend | DB column |
|----------|-----------|
| `taskId` | `WorkflowTaskId` |
| `kind` | `Kind` |
| `status` | `Status` | draft / submitted / reopened |
| `propertyId` / `poNumber` | matching |
| **entire form body** | **`PayloadJson`** |
| `returnNote` | `ReturnNote` |
| `submittedAtUtc` | `SubmittedAtUtc` |

### 3.8 `case_study.FieldInspectionWorkspaces` (projection)

| Payload key | Workspace column |
|-------------|------------------|
| `inspectionDate` | `InspectionDate` |
| `inspectionTime` | `InspectionTime` |
| `mapLatitude` / `mapLongitude` | `MapLatitude` / `MapLongitude` |
| `inspectionConfirmed` | `InspectionConfirmed` |
| (computed) | `RequiredPhotoSlots`, `CompletedPhotoSlots`, `PendingPhotoApprovals`, `ObservationCount`, `AttachmentCount` |

### 3.9 `failures.PropertyFailures`

| Frontend (catalog) | DB column |
|--------------------|-----------|
| `failurePoNumber` / `poNumber` | `PoNumber` |
| `failurePropertyId` / `propertyId` | `PropertyId` (string) |
| `failureDeedNumber` / `deedNumber` | `DeedNumber` |
| `failureTitle` / `title` | `Title` |
| `problemTypeId` | `ProblemTypeId` |
| `failureSeverity` / `severity` | `Severity` | suspected \| internal |
| `raisedByRole` | `RaisedByRole` |
| `internalNote` | `InternalNote` |
| `finalNote` | `FinalNote` |
| `resolutionReason` | `ResolutionReason` |
| `continueInstructions` | `ContinueInstructions` |
| `failureStatus` / `status` | `Status` |
| `failureSpecialist` / `specialist` | `Specialist` |

### 3.10 Optional: `case_study.InspectorFeeLedgers`

| Frontend DTO | DB column |
|--------------|-----------|
| `workflowTaskId` | `WorkflowTaskId` |
| `poNumber`, `propertyId`, `assigneeId` | matching |
| `inspectorType` | `InspectorType` |
| `agreedFeeSar` | `AgreedFeeSar` |
| `supervisorDiscountSar` / `discountReason` | matching |
| `billingStatus` | `BillingStatus` |
| `excludedFromBatch` / `exclusionReason` | matching |
| `returnTo`, `disbursementBatchId`, `disbursementVoucher` | matching |
| `accruedAtUtc` | `AccruedAtUtc` | engineering fee payable timestamp |

---

## 4. UI field catalog (by screen)

Source: `PROPERTY_FIELDS_CATALOG`.  
**Persist** = how a standalone module should store it.  
**Alias** = Infath/catalog label → storage key when different.

### 4.1 PO intake — `po-intake`

| Key | Label (AR) | Persist |
|-----|------------|---------|
| `id` | معرّف العقار (داخلي) | `WorkOrderProperties.Id` |
| `identifierType` | مصدر البيانات | column |
| `deedNumber` | رقم الصك / رقم التسجيل العيني | column |
| `assignmentMandateNumber` | رقم التكليف | column |
| `assignmentMandateDate` | تاريخ التكليف | column |
| `requestNumber` | رقم الطلب | column |
| `planNumber` | رقم المخطط | column |
| `plotNumber` | رقم القطعة | column |
| `locationMapUrl` | رابط موقع الخريطة | column |
| `deedDate` | تاريخ الصك | column |
| `ownerName` | اسم المالك | column |
| `court` | المحكمة | column |
| `circuit` | الدائرة | column |
| `delegationLetterFileNames` | خطاب التفويض | → `DelegationLetterFileName` |
| `realEstateRegFileName` | السجل العقاري (مرفق) | column |
| `assignmentDocFileNames` | قرار الإسناد | → `AssignmentDocFileName` |
| `otherDocumentFileNames` | مستندات أخرى | column (JSON) |
| `contactName` | ضابط الاتصال — الاسم | `PropertyContacts` (flattened UI) |
| `contactRole` | ضابط الاتصال — الصفة | same |
| `contactPhone` | ضابط الاتصال — الجوال | same |
| `contacts` | ضباط الاتصال (قائمة) | `PropertyContacts` rows |

### 4.2 Bourse — `bourse`

| Key | Label (AR) | Persist |
|-----|------------|---------|
| `city` | المدينة | column |
| `district` | الحي | column |
| `classification` | التصنيف | column |
| `propertyType` | نوع العقار | column |
| `area` | المساحة | column |
| `deedStatus` | حالة الصك | column |
| `restrictionsPresent` | القيود على العقار | column (+ `restrictionType`, `restrictionOtherReason`) |
| `boundariesAvailability` | توفر الحدود | column (+ boundary N/S/E/W columns) |
| `boundariesExternalDocName` | المستند الخارجي للحدود | column |
| `bourseDataCompleted` | اكتمال بيانات البورصة | column |

### 4.3 Bourse obstruction — `bourse-obstruction`

| Key | Label (AR) | Persist |
|-----|------------|---------|
| `deedVitality` | فعالية الصك (البورصة) | UI / may map to deed status |
| `obstructionReason` | سبب التعذر — استعلام البورصة | `WorkflowTasks.ObstructionReason` |

### 4.4 Property detail (workflow summary) — `property-detail`

| Key | Label (AR) | Persist |
|-----|------------|---------|
| `workflowSurvey` | مرحلة الرفع المساحي | derived from tasks |
| `workflowValuation` | مرحلة التقييم | derived |
| `workflowStudy` | مرحلة دراسة الحالة | derived |
| `propertyRowStatus` | حالة العقار في الجدول | derived |
| `appraisalPrice` | سعر التقييم | from appraisal payload `evaluatorPrice` |
| `appraisalSummaryDate` | تاريخ التقييم (ملخص) | from payload |
| `appraisalEntity` | جهة التقييم | derived / assignee |
| `appraiserNotes` | ملاحظات المقيّم (ملخص) | from payload |
| `certificateNumber` | رقم الشهادة | product-specific |
| `reportStatus` | حالة التقرير | submission status |

### 4.5 Property detail basic (display) — `property-detail-basic`

Display-only composites (`*Display`). Prefer computing from property + party payloads; do not duplicate as columns unless reporting requires it.

| Key | Label (AR) |
|-----|------------|
| `ownershipStatus` | حالة الملك |
| `coordinatesDisplay` | الإحداثيات |
| `dimensionsDisplay` | الأطوال والأبعاد |
| `landFacadesDisplay` | واجهات الأرض |
| `plotPlanNumberDisplay` | رقم القطعة / المخطط |
| `contactPartyDisplay` | جهة الاتصال |
| `contactPhoneDisplay` | رقم الجوال |
| `bourseDeedStatusDisplay` | حالة الصك في البورصة |
| `bourseDiffNotesDisplay` | الفروق / الملاحظات |
| `bourseLastUpdateDisplay` | تاريخ آخر تحديث (البورصة) |

### 4.6 Property detail hero — `property-detail-hero`

| Key | Label (AR) | Persist |
|-----|------------|---------|
| `propertyIndex` | ترتيب العقار في أمر العمل | `PropertyOrdinal` / list index |
| `assignmentType` | نوع الإسناد | `WorkOrders.AssignmentType` |
| `dueDateAt` | تاريخ الاستحقاق | `WorkOrders.DueDateAt` |

---

### 4.7 Field inspection — core — `inspector-core`

Most of these live in **`PartyTaskSubmissions.PayloadJson`** (`kind = field-inspection`). Some overlap Infath keys below.

| Key | Label (AR) | Persist |
|-----|------------|---------|
| `propertyDisplayId` | رقم العقار | derived |
| `propertyType` | نوع العقار | property column / payload |
| `areaDistrict` | المنطقة / الحي | derived from city/district |
| `actualAreaSqm` | المساحة الفعلية (م²) | PayloadJson |
| `structuralCondition` | الحالة الإنشائية | PayloadJson |
| `hasMovableItems` | هل يوجد منقولات داخل العقار؟ | PayloadJson |
| `isCurrentlyRented` | هل العقار مؤجر حالياً؟ | PayloadJson |
| `accessDifficulty` | إمكانية الوصول للعقار | PayloadJson |
| `avgPricePerSqm` | متوسط سعر المتر (ر.س) | PayloadJson |
| `marketActivityLevel` | مستوى النشاط السوقي | PayloadJson |
| `marketNotes` | ملاحظات السوق | PayloadJson |
| `responsiblePersonName` | اسم الموقّع | PayloadJson |
| `responsiblePersonRole` | صفة الموقّع | PayloadJson |
| `signedDocumentPhotos` | صور المستندات الموقعة | PayloadJson / attachments |
| `photoMainFacade` | صورة — واجهة رئيسية | PayloadJson / attachments |
| `photoEntrance` | صورة — المدخل | same |
| `photoInterior` | صورة — الداخل | same |
| `photoSurroundings` | صورة — المحيط | same |
| `generalNotes` | ملاحظات عامة | PayloadJson |

### 4.8 Field inspection — Infath labels — `inspector-infath`

| Catalog key | Label (AR) | Storage key (PayloadJson) |
|-------------|------------|---------------------------|
| `inspectionDate` | تاريخ المعاينة | `inspectionDate` (+ `inspectionTime`) |
| `facade` | الواجهة | payload |
| `streetWidth` | عرض الشارع (م) | **`streetWidthM`** |
| `builtArea` | مساحة البناء (م²) | **`builtArea`** / `builtAreaSqm` |
| `propertyUsage` | استخدام العقار | payload |
| `streetName` | اسم الشارع | `streetName` |
| `mainStreet` | اسم أقرب شارع رئيسي | **`mainStreetName`** |
| `mapCoords` | الموقع على الخارطة | **`mapLatitude`**, **`mapLongitude`** |
| `roomCount` | عدد الغرف | `roomCount` |
| `hallCount` | عدد الصالات | `hallCount` |
| `unitCount` | عدد الشقق | `unitCount` |
| `bathroomCount` | عدد دورات المياه | `bathroomCount` |
| `propertyAge` | عمر العقار (سنة) | **`propertyAgeYears`** |
| `showroomCount` | عدد المعارض | payload |
| `towerCount` | عدد الأبراج | payload |
| `wellCount` | عدد الآبار | payload |
| `kitchen` | مطبخ | **`hasKitchen`** |
| `carEntrance` | مدخل السيارة | **`hasCarEntrance`** |
| `hasBasement` | يوجد قبو | payload |
| `hasElevator` | يوجد مصعد | payload |
| `hasPool` | يوجد مسبح | payload |
| `buildState` | حالة البناء | payload |
| `occupancyState` | حالة الإشغال | payload |
| `districtState` | حالة الحي | payload |
| `movables` | يوجد منقولات | payload |
| `services` | الخدمات المتوفرة | **`availableServices`** (array) |
| `amenities` | المرافق المحيطة | **`surroundingAmenities`** (array) |
| `propertyDescription` | وصف العقار | payload |
| `districtProsCons` | الإيجابيات والعيوب الظاهرة على الحي | payload |
| `accessRoute` | طريقة الوصول للعقار | **`accessRouteDescription`** |
| `assetNotes` | ملاحظات على الأصل | payload |
| `buildingFloors` | عدد أدوار المباني | payload |
| `basementTotal` | إجمالي مساحة القبو (م²) | **`basementTotalSqm`** / `basementTotal` |
| `annexTotal` | إجمالي مساحة اللاحق (م²) | **`annexTotalSqm`** / `annexTotal` |
| `buildingsTotal` | إجمالي مساحة المباني (م²) | **`buildingsTotalSqm`** / `buildingsTotal` |
| `exteriorPhotos` | صور الأصل من الخارج (PDF مجمّع) | **`exteriorPhotosPdf`** |
| `interiorPhotos` | صور الأصل من الداخل (PDF مجمّع) | **`interiorPhotosPdf`** |
| `siteLocation` | موقع الأصل | payload |

### 4.9 Field inspection — storage keys — `inspector-form-keys`

| Key | Label (AR) | Persist |
|-----|------------|---------|
| `streetWidthM` | عرض الشارع (م) — مفتاح النموذج | PayloadJson |
| `builtAreaSqm` | مساحة البناء (م²) — مفتاح النموذج | PayloadJson |
| `mainStreetName` | اسم أقرب شارع رئيسي — مفتاح النموذج | PayloadJson |
| `mapLatitude` / `mapLongitude` | خط العرض / الطول | PayloadJson (+ workspace) |
| `propertyAgeYears` | عمر العقار (سنة) — مفتاح النموذج | PayloadJson |
| `hasKitchen` / `hasCarEntrance` | مطبخ / مدخل السيارة | PayloadJson |
| `availableServices` / `surroundingAmenities` | خدمات / مرافق | PayloadJson arrays |
| `accessRouteDescription` | طريقة الوصول | PayloadJson |
| `basementTotalSqm` / `annexTotalSqm` / `buildingsTotalSqm` | مساحات | PayloadJson |
| `exteriorPhotosPdf` / `interiorPhotosPdf` | PDFs | PayloadJson / files |

Also typically in payload: `inspectionConfirmed`, `hasAnnex`, `vacantLand`, `boundaryMatches`, `definedPhotos`, `freePhotos`, `observations`, `featureValues`, attachments.

---

### 4.10 Engineering survey — `engineering-core` / Infath / form keys / checklist

**Storage:** `PayloadJson` where `kind = engineering-survey`.  
Boundary lengths also exist on **`WorkOrderProperty`** from bourse — treat survey payload as authoritative for on-site survey.

| Key | Label (AR) | Persist |
|-----|------------|---------|
| `latitude` / `longitude` | خط العرض / الطول (موقع المسح) | PayloadJson |
| `surveyReportFileName` | تقرير الرفع المساحي | PayloadJson |
| `siteLetterFileName` | خطاب إقرار صحة الموقع | PayloadJson |
| `returnNote` | ملاحظة الإرجاع | column + often in payload |
| `onSiteArea` → `onSiteAreaSqm` | المساحة على الطبيعة (م²) | PayloadJson |
| `northBoundary` / `northLength` → `northBoundaryLengthM` | الحد الشمالي / الطول | PayloadJson (S/E/W same) |
| `surveyNotes` | ملاحظات الرفع المساحي | PayloadJson |
| `surveyFile` | مرفق الرفع المساحي | file ref |
| `siteConfirmed` | تأكيد الوقوف على الموقع | PayloadJson |
| `siteDeclarationSigned` | إقرار الموقع (موقّع) | PayloadJson |
| `declarationPhoneSatisfied` | (form) | PayloadJson |

**Checklist answers** (`checklist[]` or logical keys):

| Key | Label (AR) |
|-----|------------|
| `chk_deed_match` | هل الصك مطابق للرفع المساحي (الأطوال والمساحة) |
| `chk_site_declaration` | هل تم الوقوف على الموقع وتوقيع إقرار صحة الاستدلال |
| `chk_plot_mismatch` | هل يوجد اختلاف في رقم القطعة / المخطط / البلوك / الحي / المدينة |
| `chk_area_mismatch` | هل يوجد اختلاف في مساحة / أطوال الصك عن الطبيعة |
| `chk_roads_not_in_deed` | هل يوجد شوارع محتزلة / شطفات في المخطط ولم تذكر في الصك |
| `chk_overlap` | هل يوجد تداخل في الصك أو أجزاء مشتركة ظاهرياً |
| `chk_usage_in_deed` | هل ذُكر الاستخدام حسب الصك |
| `chk_vacant_land` | هل الموقع أرض فضاء |
| `chk_electric_room` | هل يوجد غرفة كهرباء داخل / خارج حدود الموقع |
| `chk_utility_boxes` | هل يوجد صناديق خدمات كهربائية / اتصالات / أخرى |
| `chk_instructions_applied` | هل تم تطبيق جميع التعليمات الصادرة في الرفع المساحي |
| `chk_fences` | هل يوجد أسوار داخلية وخارجية بمحيط المبنى القائم |
| `chk_boundary_mismatch` | هل يوجد اختلاف في الحدود / الصك أو الأفادة من المستكشف |

Each has a companion note key: `chk_*_note`.

---

### 4.11 Property appraisal — `evaluator-*`

**Storage:** `PayloadJson` where `kind = property-appraisal`.

| Key | Label (AR) | Persist / alias |
|-----|------------|-----------------|
| `evaluatorPrice` | سعر التقييم | PayloadJson |
| `evaluatorNotes` | ملاحظات المقيّم | PayloadJson |
| `reportFileName` | تقرير التقييم (مرفق) | PayloadJson |
| `appraisalDate` | تاريخ التقييم | PayloadJson |
| `valuationMethod` | الأسلوب المستخدم | PayloadJson |
| `valueBasis` | أساس القيمة | PayloadJson |
| `demandLevel` | حجم الطلب على العقار | PayloadJson |
| `landValue` / `buildingValue` | قيمة الأرض / المباني | PayloadJson |
| `forcedDiscount` | نسبة خصم البيع القسري | **`forcedSaleDiscountPct`** |
| `searchScope` | نطاق البحث ومصادر معلومات القيم | **`searchScopeNotes`** |
| `planPhoto` | صورة الأصل من المخطط (PDF) | **`planImageFileName`** |
| `appraiserAddress` / `appraiserPhone` | عنوان / تواصل المقيّم | PayloadJson |
| `reportIssueDate` | تاريخ إصدار التقرير | PayloadJson |
| `signedAppraisal` | مرفق التقييم المعتمد | PayloadJson / file |

**Checklist (nested `checklist.*` or flat keys):**

| Key | Label (AR) |
|-----|------------|
| `q_plan_match` | هل رقم المخطط مطابق للصك؟ |
| `q_excess_zoning` | هل القطعة زائدة تنظيمية؟ |
| `q_land_waqf` | هل الأرض موقوفة؟ |
| `q_property_waqf` | هل العقار موقوف؟ |
| `q_expropriation` | هل يوجد نزع على منطقة العقار؟ |
| `q_property_use_verified` | هل تم التأكد من استخدام العقار؟ |
| `q_agriculture_inquiry` | هل تم الاستعلام من وزارة الزراعة حيال الأرض الزراعية؟ |
| `q_overlap` | هل يوجد تداخل في الأصل؟ |
| `q_shared_building` | هل يوجد على الأصل مبنى مشترك؟ |
| `q_environmental_factors` | هل هناك عوامل بيئية أو تنظيمية قد تؤثر على العقار؟ |
| `q_unregistered_additions` | هل العقار يحتوي على إضافات غير مسجلة في الصك؟ |
| `q_shared_deed` | هل الصك مشاع؟ |
| `shared_deed_scope` | نطاق الملكية في الصك المشاع |
| `shared_deed_percentage` | نسبة الملكية في الصك المشاع |
| `q_lease_exists` | هل يوجد عقد إيجار؟ |
| `q_lease_active` | هل عقد الإيجار ساري؟ |
| `q_technical_notes_exists` | هل يوجد ملاحظات فنية قد تؤثر على قيمة العقار؟ |
| `technical_notes_text` | نص الملاحظات الفنية |

> Note: legacy `valuation.ValuationRequests` uses DTO aliases `propId`/`type`/`date` → `PropertyId`/`PropertyType`/`RequestDate`. Appraisal **form data** lives in party submission, not that table.

---

### 4.12 Government review — `government` / form keys / keys tab

**Storage:** `PayloadJson` where `kind = government-review`. May side-effect into KeyEnvelope (platform) — optional for standalone.

| Catalog key | Label (AR) | Storage key |
|-------------|------------|-------------|
| `visitStatus` | حالة الزيارة | same |
| `visitDate` | تاريخ الزيارة | same |
| `courtName` | اسم المحكمة | same |
| `keysStatus` | حالة المفاتيح | same |
| `keysDescription` | وصف المفاتيح | same |
| `accessBlockReason` | سبب تعذّر الوصول | same |
| `reviewNotes` | ملاحظات المراجعة | same |
| `zoneStatus` | حالة منطقة العقار (وقف) | **`propertyZoneStatus`** |
| `keysProof` | إثبات استلام المفتاح | **`keysProofFiles[]`** |
| `keysReceived` | هل تم استلام المفتاح من الدائرة؟ | related / `keyHandedToInspector` |
| `confirmed` | تأكيد المراجعة | same |

**Keys tab (UI composites):** `keysTabCourt`, `keysTabStatus`, `keysTabVisitStatus`, `keysTabVisitDate`, `keysTabStorageLocation`, `keysTabAccessNote`, `keysTabReviewer` — mostly derived from gov payload + keys module.

---

### 4.13 Case study form questions — `case-study-*`

Meta columns: see §3.6.  
Question keys go into **`AnswersJson`**:

#### Deed — `case-study-deed`

| Key | Label (AR) |
|-----|------------|
| `deed_0` | هل الصك فعال |
| `deed_1` | هل رقم القطعة مطابق للصك |
| `deed_2` | هل رقم المخطط مطابق للصك |
| `deed_3` | هل القطعة زائدة تنظيمية |
| `deed_4` | هل يوجد نزع على منطقة العقار |
| `deed_5` | هل الأرض موقوفة |
| `deed_6` | هل العقار موقوف |
| `deed_7` | هل تم التأكد من استخدام العقار |
| `deed_8` | هل تم الاستعلام من وزارة الزراعة حيال الأرض الزراعية |
| `deed_9` | هل الصك مشاع |
| `deed_10` | في حال الصك المشاع — نطاق الملكية والنسبة |

#### Survey — `case-study-survey`

| Key | Label (AR) |
|-----|------------|
| `survey_0` | هل الصك مطابق للرفع المساحي |
| `survey_1` | هل تم ذكر جميع الاختلافات في الرفع المساحي |
| `survey_2` | هل تم تطبيق جميع التعليمات الصادرة من المركز في الرفع المساحي |
| `survey_3` | هل تم التوقيع وإرفاق إقرار على صحة الموقع |
| `survey_4` | هل يوجد تداخل في الأصل |
| `survey_5` | هل يوجد على الأصل مبنى مشترك |
| `survey_6` | هل ذكر المرجع المعتمد في الاستدلال على استخدام العقار |

#### Components — `case-study-comp`

| Key | Label (AR) |
|-----|------------|
| `comp_0` | هل يوجد في العقار بئر |
| `comp_1` | هل يوجد في العقار غرفة كهرباء |
| `comp_2` | هل يوجد في العقار أبراج كهرباء |
| `comp_3` | هل يوجد في العقار أبراج اتصالات |
| `comp_4` | هل يوجد في العقار مضخة دفاع مدني |
| `comp_5` | هل يوجد في العقار منقولات |
| `comp_6` | هل يوجد في العقار مركبات |
| `comp_7` | هل يوجد في العقار معدات زراعية أو موجودات حيوية |
| `comp_8` | هل تم مطابقة مكونات العقار على الطبيعة مع المكونات المذكورة في الصك |

#### Occupancy — `case-study-occ`

| Key | Label (AR) |
|-----|------------|
| `occ_0` | هل العقار مأهول بالسكن |
| `occ_1` | هل يوجد عقد إيجار |
| `occ_2` | هل تم مطابقة رقم الصك بالمذكور بعقد الإيجار |
| `occ_3` | هل عقد الإيجار ساري |
| `occ_4` | هل عقد الإيجار إلكتروني |
| `occ_5` | هل يوجد اتحاد ملاك؟ |

#### Extra — `case-study-extra`

| Key | Label (AR) |
|-----|------------|
| `extra_0` | هل تم ذكر جميع الملاحظات للتوضيح في حال عدم المطابقة |
| `extra_1` | هل يوجد ملاحظات فنية قد تؤثر على قيمة العقار |
| `extra_2` | هل هناك عوامل بيئية أو تنظيمية قد تؤثر على العقار |
| `extra_3` | هل العقار يحتوي على أي إضافات غير مسجلة في الصك |

#### Meta remarks / meter / signatures — `case-study-meta`

| Key | Label (AR) | Persist |
|-----|------------|---------|
| `requestNumber` / `requestDate` / `deedNumber` | رقم/تاريخ الطلب / الصك | columns |
| `deedRemarks` / `surveyRemarks` / `componentsRemarks` / `occupancyRemarks` | ملاحظات الأقسام | columns |
| `meterType` / `meterNumber` / `hoaFee` | عداد / رسوم اتحاد | columns |
| `sigDeed` / `sigApprover` / `sigDate` | توقيعات | columns |

#### Specialist Infath — `specialist-infath` / `specialist-form-keys`

| Catalog | Storage column / key |
|---------|----------------------|
| `linkedAssets` | `InfathLinkedAssets` |
| `linkedDeedNumbers` | `InfathLinkedDeedNumbers` |
| `linkedAssetsNotes` | `InfathLinkedAssetsNotes` |
| `otherNotes` | `InfathOtherNotes` |
| `closingNotes` | `InfathClosingNotes` |
| `specialistReviewApproved` | `SpecialistReviewApprovedJson` |

---

### 4.14 Failures — `failures`

See §3.9 for DB columns. Catalog keys: `failureTitle`, `problemTypeId`, `failureSeverity`, `failureStatus`, `raisedByRole`, `internalNote`, `finalNote`, `resolutionReason`, `continueInstructions`, `failureSpecialist`, `failurePoNumber`, `failurePropertyId`, `failureDeedNumber`.

---

### 4.15 Workflow meta — `workflow-meta`

Derived from tasks + submissions (not separate property columns):  
`taskStatus`, `submissionStatus`, `submittedAt`, `updatedAt`, `formCurrentStep`, `answersCompleted`, `checklistCompleted`, `surveySubmissionStatus`, `inspectionSubmissionStatus`, `appraisalSubmissionStatus`, `governmentReviewStatus`.

---

### 4.16 Party panel derived — `party-panel`

UI read-models over party payloads (`partyCoords`, `partyActualArea`, …). Do not persist separately in a standalone core schema.

---

### 4.18 Property documents — `property-documents`

Logical document slots mapping to filename columns / payload file refs / attachment store:

| Key | Maps to |
|-----|---------|
| `docRealEstateReg` | `RealEstateRegFileName` |
| `docAssignmentDecree` | `AssignmentDocFileName` |
| `docDelegationLetter` | `DelegationLetterFileName` |
| `docBoundariesExternal` | `BoundariesExternalDocName` |
| `docOtherIntake` | `OtherDocumentFileNames` |
| `docSurveyReport` | survey `surveyReportFileName` |
| `docSiteDeclarationLetter` | `siteLetterFileName` |
| `docAppraisalReport` | `reportFileName` |
| `docSignedInspection` / photo docs | inspection attachments |

---

### 4.19 System auto — `system-auto`

Mostly computed for Infath export: `reportNumber`, `assetSubject`, `deedAreaRef`, `areaDiff`, `totalValue`, `forcedSaleValue`, `deedPhoto`.

---

### 4.20 Infath worker license — `infath-worker-license`

**Spec only (not implemented):** `workerName`, `workerLicenseNumber`, `workerLicenseDate`, `workerLicenseAttachment`.

---

### 4.21 Backend API mirror — `backend-api`

Explicit entity paths for property columns (see §3.2 / §3.3):  
`WorkOrderProperty.*`, `PropertyContact.*`.

---

## 5. Suggested standalone data model (minimal)

```text
WorkOrder 1──* WorkOrderProperty 1──* PropertyContact
     │                  │
     │                  └──* WorkflowTask (parent + children)
     │                            │
     │                            ├── CaseStudyForm (AnswersJson + columns)
     │                            ├── PartyTaskSubmission (PayloadJson)
     │                            │         └── FieldInspectionWorkspace (optional projection)
     │                            └── InspectorFeeLedger (optional)
     └──* PropertyFailure (by poNumber + propertyId string)
```

**Files:** keep a separate `attachments` table or object storage with `(entityType, entityId, fieldKey, fileName, url)`.

---

## 6. Naming cheat sheet

| Pattern | Example |
|---------|---------|
| FE camelCase ↔ DB PascalCase | `deedNumber` ↔ `DeedNumber` |
| Infath label vs storage | `streetWidth` → `streetWidthM` |
| Nested JSON | answers, party payloads, checklists, distribution |
| DTO alias ≠ column | Valuation list: `propId`/`type`/`date`; Keys module: `idProp`/`po`/`key` |
| Dual storage | Boundaries on property **and** survey payload |
| Display-only | `*Display`, `party*`, many workflow stage badges |

---

## 7. Source files in this repo

| Layer | Path |
|-------|------|
| UI field catalog | `packages/app-shared/src/prototype/property-fields-catalog.ts` |
| Domain entities | `backend/RealEstateEval.Domain/*.cs` |
| Work order / property API | `packages/api-client/src/work-orders.ts` |
| Case study forms | `packages/api-client/src/case-study-forms.ts` |
| Party submissions | `packages/api-client/src/party-task-submissions.ts` |
| Inspector fees | `packages/api-client/src/inspector-fees.ts` |
| DB overview (broader platform) | `docs/DATABASE_OVERVIEW.md` |
| Infath field notes | `docs/infath_case_study_fields.md`, `docs/الرفع على النفاذ/` |

---

## 8. Maintenance

When adding a product field:

1. Add/update the key in `property-fields-catalog.ts` (label + group).
2. Decide: **column** vs **JSON key** (prefer JSON for party checklists; columns for query/filter fields).
3. Update this doc’s matching section.
4. If Infath export uses a different name, document the **alias** in the Infath column of the table.
`)