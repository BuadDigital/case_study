# Users, Roles, and System Vocabulary

Reference for who exists in the system, what each role may do, and the exact Arabic
wording each English identifier maps to. Every table below is derived from code, not
from prose — the "source" lines point at the file that owns the value.

Contents:

1. [The five identity concepts](#1-the-five-identity-concepts)
2. [Seeded user directory](#2-seeded-user-directory)
3. [Role reference](#3-role-reference)
4. [Capability glossary](#4-capability-glossary)
5. [Authorization policies](#5-authorization-policies)
6. [Page and module glossary](#6-page-and-module-glossary)
7. [Workflow vocabulary](#7-workflow-vocabulary)
8. [Status vocabularies](#8-status-vocabularies)
9. [Enums](#9-enums)
10. [PO role matrix](#10-po-role-matrix)
11. [Sessions and tokens](#11-sessions-and-tokens)
12. [Where each term lives](#12-where-each-term-lives)

---

## 1. The five identity concepts

A user is described by five separate things. Confusing them is the most common source
of "why can't this account see that screen" questions.

| Concept | Arabic wording | Example value | What it decides |
| --- | --- | --- | --- |
| **Identity role** | الدور في الهوية | `CDO`, `HR`, `PROC`, `CRM` | ASP.NET Identity role rows. `CDO` and `Admin` grant everything; `HR`, `PROC`, `CRM` grant only `system-screen-catalog`; `Editor` / `Supervisor` grant nothing |
| **Permission level** | مستوى الصلاحية | `مدير`, `مشرف`, `محرر`, `cdo` | Informational HR grade stored on the profile. Only the literal value `cdo` affects access |
| **Job title** | المسمى الوظيفي | `أخصائي دراسة حالة` | The **real** driver of access: an exact-match allowlist maps it to a prototype role |
| **Prototype role** | الدور الوظيفي في النظام | `case-specialist` | The English role id that owns the page list and capability list |
| **Distribution assignee id** | معرّف الإسناد | `fi-ahmed` | Identifies the account as a *party* that work can be assigned to, and scopes what it can read |

**Resolution order** (`PrototypeRoleResolver.Resolve`):

1. Identity role `CDO` or `Admin` → prototype role `cdo` (full access).
2. Profile `PermissionLevel == "cdo"` → prototype role `cdo`.
3. Exact `JobTitle` match against the allowlist → that prototype role.
4. No match → no prototype role, so no pages and no capabilities.

The allowlist is deliberately exact — no fuzzy or "contains" matching. A job title
typed with a different dash or spacing yields an account with zero access.

| Job title (المسمى الوظيفي) | Prototype role |
| --- | --- |
| `مسؤول التحول الرقمي (CDO)` | `cdo` |
| `مدير إدارة التقييم العقاري` | `general-manager` |
| `مشرف قسم دراسة الحالة` | `section-supervisor` |
| `أخصائي دراسة حالة` | `case-specialist` |
| `مراجع حكومي` | `government-reviewer` |
| `مقيم عقاري` | `real-estate-appraiser` |
| `معاين ميداني` | `field-inspector` |
| `موظف الشؤون المالية` | `financial-officer` |
| `مقدم خدمة — جهة` | `engineering-office` |

Source: `backend/RealEstateEval.Infrastructure/Permissions/PrototypeRoleResolver.cs:14-26`,
mirrored on the frontend in `apps/mfe-case-study/src/lib/distribution-assignees.ts:14-25`.

---

## 2. Seeded user directory

Created by `DataSeeder` on startup. These passwords are development seeds and must not
exist in a real deployment.

### Login and access

| Email used for login | Username | Password | Display name | Job title | Prototype role |
| --- | --- | --- | --- | --- | --- |
| `s.salhy@gmail.com` | `sliman` | `user1234` | سليمان | مسؤول التحول الرقمي (CDO) | `cdo` |
| `salam@ejadah.dev` | `salam` | `user1234` | سالم الغريب | مدير إدارة التقييم العقاري | `general-manager` |
| `abdulrahman@ejadah.dev` | `abdulrahman` | `user1234` | عبدالرحمن النفيعي | مشرف قسم دراسة الحالة | `section-supervisor` |
| `osama@ejadah.dev` | `osama` | `user1234` | أسامة الصالحي | أخصائي دراسة حالة | `case-specialist` |
| `feras@ejadah.dev` | `feras` | `user1234` | فراس كمرين | مراجع حكومي | `government-reviewer` |
| `abdullah.kathiri@ejadah.dev` | `abdullah` | `user1234` | عبدالله الكثيري | مقيم عقاري | `real-estate-appraiser` |
| `ahmed@ejadah.dev` | `ahmed` | `user1234` | أحمد سعيد | معاين ميداني | `field-inspector` |
| `abdullah.abdulmane@ejadah.dev` | `abdullah_m` | `user1234` | عبدالله عبدالمانع | معاين ميداني | `field-inspector` |
| `eman@ejadah.dev` | `eman` | `user1234` | إيمان النهدي | موظف الشؤون المالية | `financial-officer` |
| `survey.jeddah@ejadah.dev` | `jeddah_survey` | `user1234` | مكتب جدة للمساحة | مقدم خدمة — جهة | `engineering-office` |
| `admin@local.dev` | `admin@local.dev` | `user1234` | سالم الغريب | — (legacy account) | `cdo` via identity role `Admin` |

### Organization placement

| Username | Department (الإدارة) | Section (القسم) | Permission level | Employment | Contract type | Identity roles | Assignee id | رقم العضوية |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `sliman` | الإدارة التنفيذية | — | `cdo` | دوام كامل | Internal | `CDO`, `HR` | — | — |
| `salam` | إدارة التقييم العقاري | — | مدير | دوام كامل | Internal | `HR`, `Editor` | — | — |
| `abdulrahman` | إدارة التقييم العقاري | قسم دراسة الحالة | مشرف | دوام كامل | Internal | `HR`, `Supervisor` | — | — |
| `osama` | إدارة التقييم العقاري | قسم دراسة الحالة | محرر | دوام كامل | Internal | `HR`, `Editor` | — | — |
| `feras` | إدارة التقييم العقاري | قسم دراسة الحالة | محرر | دوام كامل | Internal | `HR`, `Editor` | `gov-firas` | — |
| `abdullah` | إدارة التقييم العقاري | قسم تقييم الأفراد | محرر | دوام كامل | Internal | `HR`, `Editor` | `val-abdullah` | — |
| `ahmed` | إدارة التقييم العقاري | قسم تقييم الأفراد | محرر | متعاون | Freelance | `HR`, `Editor` | `fi-ahmed` | `FI-002` |
| `abdullah_m` | إدارة التقييم العقاري | قسم تقييم الأفراد | محرر | دوام كامل | Internal | `HR`, `Editor` | `fi-abdullah-abdulmane` | `FI-001` |
| `eman` | الإدارة المالية | قسم المحاسبة | محرر | دوام كامل | Internal | `HR`, `Editor` | — | — |
| `jeddah_survey` | مكتب جدة للمساحة (مسح ميداني، مكة المكرمة) | — | — | — | ServiceProvider | `PROC` | `eo-jeddah` | — |

Notes:

- The `Editor` and `Supervisor` identity roles grant nothing on their own; they are
  legacy grade markers. Access comes from the job title.
- `feras` additionally carries reviewer city coverage `["الرياض","الطائف"]`
  (`ReviewerCityCoverageJson`), which scopes the government-review queue by city.
- Accounts with an assignee id are the ones that can receive distributed work; the five
  values above are the only parties in the seed data.
- `jeddah_survey` is seeded as a procurement service provider (`مقدم خدمة — جهة`), not
  as HR staff, which is why its job title differs from its displayed role label.

Source: `backend/RealEstateEval.Infrastructure/Data/DataSeeder.cs:188-544` and `:1091-1139`.

---

## 3. Role reference

Nine prototype roles exist. For each: the Arabic label users see, the pages granted, the
capabilities granted, and the page the user lands on after login.

Pages and capabilities are granted by the server catalog
(`PlatformPermissionCatalog`) and mirrored by the frontend `ROLES` table. The landing
page is the first granted page in sidebar order, with two exceptions coded into
`defaultLandingPage`: `dashboard` always wins, and a role holding both `operations-tasks`
and `keys` without `all-transactions`/`active-case-study` lands on `operations-tasks`.

### `cdo` — المسؤول / مسؤول التحول الرقمي

- **Pages:** all 28 navigation pages.
- **Capabilities:** all 12.
- **Landing:** `dashboard` — لوحة التحكم.
- Only role that sees the dashboard and the orphan/legacy screens.

### `general-manager` — مدير إدارة التقييم العقاري

- **Pages:** `po`, `all-transactions`, `active-primary-data`, `bourse-inquiry`,
  `active-distribution`, `active-case-study`, `keys`, `failures`,
  `suspended-transactions`, `valuation-requests`, `financial`, `courts`,
  `failure-types`, `case-study-info-roles`, `system-screen-catalog`.
- **Capabilities:** `manage-valuation-requests`, `manage-failures`, `manage-work-orders`,
  `submit-party-work`, `manage-attachments`, `manage-financial`, `manage-operations`.
- **Landing:** `po` — أوامر العمل.

### `section-supervisor` — مشرف قسم دراسة الحالة

- **Pages:** `po`, `active-primary-data`, `bourse-inquiry`, `active-distribution`,
  `active-case-study`, `operations-tasks`, `keys`, `failures`, `suspended-transactions`,
  `failure-types`, `party-fees`, `system-screen-catalog`.
- **Capabilities:** `manage-failures`, `manage-work-orders`, `submit-party-work`,
  `manage-attachments`, `manage-operations`, `courts.manage`.
- **Landing:** `po` — أوامر العمل.
- Can override party work and edit the PO header; does not see `all-transactions`.

### `case-specialist` — أخصائي دراسة حالة

- **Pages:** `po`, `active-primary-data`, `bourse-inquiry`, `active-distribution`,
  `active-case-study`, `operations-tasks`, `failures`, `suspended-transactions`,
  `system-screen-catalog`.
- **Capabilities:** `manage-failures`, `manage-work-orders`, `submit-party-work`,
  `manage-attachments`.
- **Landing:** `po` — أوامر العمل.
- Owns property editing and accept/reopen of party submissions.

### `real-estate-appraiser` — مقيم عقاري

- **Pages:** `po`, `all-transactions`, `operations-tasks`, `property-appraisal`,
  `failures`, `suspended-transactions`, `system-screen-catalog`.
- **Capabilities:** `submit-valuation-report`, `submit-party-work`, `manage-attachments`.
- **Landing:** `po` — أوامر العمل.

### `field-inspector` — معاين ميداني

- **Pages:** `all-transactions`, `operations-tasks`, `party-fees`, `failures`,
  `system-screen-catalog` (plus legacy `property-inspection`, hidden for non-CDO).
- **Capabilities:** `submit-party-work`, `manage-attachments`.
- **Landing:** `all-transactions` — جميع المعاملات.

### `government-reviewer` — مراجع حكومي

- **Pages:** `po`, `operations-tasks`, `party-fees`, `keys`, `failures`,
  `system-screen-catalog`.
- **Capabilities:** `submit-party-work`, `manage-attachments`, `manage-operations`.
- **Landing:** `operations-tasks` — المهام.
- `all-transactions` and the legacy `government-review` list are both removed for this
  role; the work is done from operations tasks.

### `engineering-office` — مكتب هندسي (رفع مساحي)

- **Pages:** `all-transactions`, `active-survey`, `party-fees`, `failures`,
  `system-screen-catalog`.
- **Capabilities:** `submit-party-work`, `manage-attachments`.
- **Landing:** `all-transactions` — جميع المعاملات.
- For this role, fee billing appears under active transactions as `فوترة الأتعاب`
  rather than under system settings.

### `financial-officer` — موظف مالي (الشؤون المالية)

- **Pages:** `financial`, `system-screen-catalog`.
- **Capabilities:** `manage-financial`, `manage-attachments`.
- **Landing:** `financial` — التقارير المالية.

Source: `backend/RealEstateEval.Infrastructure/Permissions/PlatformPermissionCatalog.cs:45-134`,
`packages/app-shared/src/prototype/constants.ts:12-163`,
`packages/app-shared/src/prototype/page-access.ts:8-42`,
`packages/app-shared/src/prototype/permissions-pages.ts:23-45`.

---

## 4. Capability glossary

Capabilities are the unit of authorization. They are baked into the access token as
`capability` claims and checked by policy on the server and by `hasCapability` /
`<Can>` on the client.

| Capability | Meaning | Held by |
| --- | --- | --- |
| `manage-users` | إدارة المستخدمين — create, list, delete staff | `cdo` |
| `manage-system-config` | إعدادات النظام — fee pricing, audit-log controls, treated as super admin on the client | `cdo` |
| `reset-system-data` | تصفير بيانات النظام — development reset panel | `cdo` |
| `manage-valuation-requests` | إدارة طلبات التقييم | `cdo`, `general-manager` |
| `manage-failures` | إدارة التعذرات — full failure queue | `cdo`, `general-manager`, `section-supervisor`, `case-specialist` |
| `submit-valuation-report` | إرسال تقرير التقييم | `cdo`, `real-estate-appraiser` |
| `manage-work-orders` | إدارة أوامر العمل — PO and property writes, distribution | `cdo`, `general-manager`, `section-supervisor`, `case-specialist` |
| `submit-party-work` | تنفيذ مهام الأطراف — draft/submit assigned task work | every role except `financial-officer` |
| `manage-attachments` | المرفقات — upload and delete | all ten roles |
| `manage-financial` | الشؤون المالية — revenue, billing, pricing | `cdo`, `general-manager`, `financial-officer` |
| `manage-operations` | العمليات — operations tasks, key custody, fee supervision | `cdo`, `general-manager`, `section-supervisor`, `government-reviewer` |
| `courts.manage` | المحاكم والدوائر — court catalog writes | `cdo`, `section-supervisor` |
| `authenticated` | Declared constant meaning "any signed-in user". It is not part of the grantable catalog and no role holds it; only the integration-test auth handler emits it | nobody |

Source: `backend/RealEstateEval.Application/Authorization/PlatformCapabilities.cs`.

---

## 5. Authorization policies

Server endpoints reference policy names, not capabilities directly. Simple policies
require one capability; composite policies accept any of several, for reads that more
than one department legitimately needs.

| Policy | Requires |
| --- | --- |
| `Capability:<name>` | That single capability (one policy per capability above) |
| `Capability:raise-failures` | `manage-failures` **or** `submit-party-work` — parties raise failures, case staff manage the queue |
| `Capability:read-financial-data` | `manage-financial` **or** `manage-work-orders` — revenue and billing reads |
| `Capability:read-management-reports` | `manage-work-orders` only — dashboards and cross-queue aggregates. The doc comment on the constant also mentions finance, but the registration does not include it, so `financial-officer` cannot read the reporting dashboard |
| `Capability:read-valuation-queue` | `manage-valuation-requests` **or** `submit-valuation-report` |
| `Capability:read-key-data` | `manage-operations` **or** `manage-financial` — key custody and key fees |

Beyond policies, read endpoints apply **actor scoping**: a party sees only rows whose
assignee id matches its own `DistributionAssigneeId`, while case staff see the whole
queue. Denied reads return `404`, not `403`, so ids cannot be probed.

Source: `backend/shared/RealEstateEval.Shared.Web/Authorization/CapabilityPolicyNames.cs`,
`backend/shared/RealEstateEval.Shared.Web/ServiceCollectionExtensions.cs`.

---

## 6. Page and module glossary

Twenty-eight navigation pages plus `profile`. Ids are used in permissions, routes, and
the screen catalog.

| Page id | Arabic title |
| --- | --- |
| `dashboard` | لوحة التحكم |
| `po` | أوامر العمل (PO) |
| `all-transactions` | جميع المعاملات |
| `operations-tasks` | المهام |
| `keys` | إدارة المفاتيح (محفظة المفاتيح) |
| `failures` | إدارة التعذرات |
| `suspended-transactions` | المعاملات المعلقة |
| `active-primary-data` | البيانات الأولية |
| `bourse-inquiry` | استعلام بورصة |
| `active-distribution` | توزيع المعاملات |
| `active-case-study` | دراسة حالة العقارات |
| `property-appraisal` | تقييم العقار |
| `active-survey` | الرفع المساحي |
| `party-fees` | الأتعاب والصرف (فوترة الأتعاب) |
| `valuation-requests` | طلبات التقييم |
| `financial` | التقارير المالية |
| `system-fields-catalog` | قاموس الحقول المركزي |
| `system-screen-catalog` | دليل الشاشات |
| `users` | المستخدمون |
| `fee-pricing` | التسعيرة |
| `audit-log` | سجل التدقيق |
| `courts` | المحاكم و الدوائر |
| `failure-types` | أنواع التعذرات |
| `case-study-info-roles` | علاقة المستخدم بالمعلومة |
| `survey` | مكاتب الرفع الهندسي (يتيمة) |
| `government-review` | المراجعة الحكومية (يتيمة) |
| `property-inspection` | معاينة العقار (يتيمة) |
| `profile` | البروفايل — available to every signed-in user |

"يتيمة" (orphan) pages are legacy screens kept for reference and shown only to `cdo`.

Source: `packages/types/src/navigation.ts:2-31`,
`packages/app-shared/src/prototype/constants.ts:165-255`,
`backend/RealEstateEval.Infrastructure/Permissions/PlatformPermissionCatalog.cs:6-15`.

---

## 7. Workflow vocabulary

Work reaches a party as a **workflow task** (مهمة) carrying a `kind`. Each kind has one
owning role and one work screen.

| Task kind | Arabic | Role | Screen |
| --- | --- | --- | --- |
| `field-inspection` | معاينة العقار | `field-inspector` | نموذج المعاينة الميدانية |
| `engineering-survey` | الرفع المساحي | `engineering-office` | مهمة الرفع المساحي |
| `government-review` | المراجعة الحكومية | `government-reviewer` | زيارة المحكمة وجمع المفاتيح |
| `property-appraisal` | تقييم العقار | `real-estate-appraiser` | شاشة التقييم |

Related terms:

| Term | Arabic | Meaning |
| --- | --- | --- |
| Work order / PO | أمر العمل | Top-level container, keyed by `PoNumber` |
| Property | العقار | A property row inside a PO, keyed by `PropertyId` |
| Distribution | توزيع المعاملات | Assigning PO properties to parties, which creates workflow tasks |
| Party | الطرف | A non-staff actor executing assigned tasks (inspector, office, reviewer) |
| Party submission | نموذج الطرف | The form a party fills for a task |
| Failure | التعذر | A blocker raised on a property |
| Key envelope | ظرف المفاتيح | Physical key custody record |
| Inspector fee | أتعاب المعاين | Fee accrued for completed party work |

Source: `packages/app-shared/src/prototype/party-task-pages.ts:24-124`.

---

## 8. Status vocabularies

| Domain | Values |
| --- | --- |
| Workflow task | `open`, `completed`, `cancelled`, `blocked` — terminal: `completed`, `cancelled` |
| Party submission | `draft`, `submitted`, `reopened` |
| Property failure | `internal`, `review`, `approved`, `returned`, `suspended`, `resolved` — active: the first four |
| Evaluator recall | `pending`, `approved`, `rejected` |

Source: `backend/RealEstateEval.Domain/WorkflowStatuses.cs`.

---

## 9. Enums

| Enum | Values | Arabic sense |
| --- | --- | --- |
| `ContractType` | `Internal`, `Freelance`, `ServiceProvider` | دوام كامل / متعاون / مقدم خدمة |
| `RegistrationSource` | `Hr`, `Proc` | مسجَّل من الموارد البشرية / من المشتريات |
| `UserStatus` | `Active`, `Inactive` | نشط / غير نشط |
| `ProcProviderKind` | `Individual`, `Organization` | فرد / جهة |

`UserStatus` is load-bearing for authentication: a profile that is not `Active` cannot
log in and cannot refresh an existing session.

Source: `backend/RealEstateEval.Domain/Enums.cs`.

---

## 10. PO role matrix

Who may act on work orders, properties, and party submissions. `cdo` may do everything.

| Action | Allowed roles |
| --- | --- |
| Receive a PO (استلام أمر العمل) | `section-supervisor`, `case-specialist` |
| Edit PO header (تعديل بيانات أمر العمل) | `section-supervisor` |
| Delete PO or property (حذف) | `section-supervisor` |
| Edit property (تعديل العقار) | `case-specialist` |
| Raise a property failure (رفع تعذر) | `case-specialist`, `section-supervisor` |
| Redistribute parties (إعادة التوزيع) | `section-supervisor`, `general-manager` |
| Accept / reopen party submissions (قبول أو إعادة فتح) | `case-specialist`, `section-supervisor`, `general-manager` |
| Manage operations tasks (إدارة المهام) | `case-specialist`, `section-supervisor`, `general-manager` |
| Draft / submit party task work | The assigned party, plus `section-supervisor` override |
| Read party task work | Any of the accept/reopen roles, plus the assigned party |

Source: `backend/RealEstateEval.Application/Rules/PoRoleMatrixRules.cs`.

---

## 11. Sessions and tokens

- Login returns a short-lived access token (`Jwt:AccessTokenMinutes`, default 15) plus a
  rotating refresh token (`Jwt:RefreshTokenHours`, default 12, absolute).
- Capabilities and roles are **baked into the access token**, so a permission change
  applies at the next refresh rather than immediately. `POST /api/auth/refresh` re-reads
  roles, capabilities, and `UserStatus` from the database on every call.
- `POST /api/auth/logout` revokes the whole session family behind a refresh token.
- The username-picker login (`/api/auth/dev-login-users`, `/api/auth/login-username`)
  requires both `ASPNETCORE_ENVIRONMENT=Development` and `Auth:EnableDevLogin=true`;
  otherwise those endpoints return 404. Production uses `POST /api/auth/login` with a
  username and password.

Details in `backend/README.md`, section "Session tokens".

---

## 12. Where each term lives

| Concern | File |
| --- | --- |
| Job title → prototype role | `backend/RealEstateEval.Infrastructure/Permissions/PrototypeRoleResolver.cs` |
| Role → pages and capabilities (server) | `backend/RealEstateEval.Infrastructure/Permissions/PlatformPermissionCatalog.cs` |
| Capability names | `backend/RealEstateEval.Application/Authorization/PlatformCapabilities.cs` |
| Policy names | `backend/shared/RealEstateEval.Shared.Web/Authorization/CapabilityPolicyNames.cs` |
| PO / party action matrix | `backend/RealEstateEval.Application/Rules/PoRoleMatrixRules.cs` |
| Seeded users | `backend/RealEstateEval.Infrastructure/Data/DataSeeder.cs` |
| Identity role constants | `backend/RealEstateEval.Domain/OrgRoles.cs` |
| Status constants | `backend/RealEstateEval.Domain/WorkflowStatuses.cs` |
| Role → pages and Arabic labels (client) | `packages/app-shared/src/prototype/constants.ts` |
| Page ids and role ids (types) | `packages/types/src/navigation.ts` |
| Landing page rule | `packages/app-shared/src/prototype/page-access.ts` |
| API page filtering | `packages/app-shared/src/prototype/permissions-pages.ts` |
| Task kinds and screen wording | `packages/app-shared/src/prototype/party-task-pages.ts` |
| Property field dictionary (Arabic labels per field) | `packages/app-shared/src/prototype/property-fields-catalog.ts` |
| Screen catalog (Arabic screen names) | `packages/app-shared/src/prototype/screen-catalog/` |

## Related business logic

- [دورة العقارات المرتبطة](./linked-properties-cycle.md) — معنى الارتباط، مصادره،
  صلاحياته، النسخ من معاملة سابقة، الأصول المصرّح بها، المهام، وظروف المفاتيح.
