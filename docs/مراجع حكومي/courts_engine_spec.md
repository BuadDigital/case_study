# المحرك الأساسي — المحاكم والدوائر

نظام إجادة | وحدة إعدادات النظام
مواصفات المطوّر — الطبقة الخلفية فقط (بدون واجهات)

---

## 1. نموذج البيانات

### 1.1 جدول `courts` (المحاكم)

| الحقل | النوع | القيود | ملاحظة |
|---|---|---|---|
| `id` | `bigint` | PK, auto | |
| `name` | `varchar(150)` | NOT NULL | اسم المحكمة |
| `region` | `varchar(80)` | NOT NULL | المنطقة الإدارية |
| `city` | `varchar(80)` | NOT NULL | المدينة |
| `is_active` | `boolean` | NOT NULL, default `true` | حالة التفعيل |
| `created_by` | `bigint` | FK → users.id, NOT NULL | من أضافها |
| `created_at` | `timestamp` | NOT NULL | |
| `updated_by` | `bigint` | FK → users.id, NULL | آخر معدّل |
| `updated_at` | `timestamp` | NULL | |

فهرس: `(region, city)`, `(is_active)`.
قيد فريد: `UNIQUE(name, city)` — لا محكمتان بنفس الاسم في نفس المدينة.

### 1.2 جدول `court_circuits` (الدوائر)

| الحقل | النوع | القيود | ملاحظة |
|---|---|---|---|
| `id` | `bigint` | PK, auto | |
| `court_id` | `bigint` | FK → courts.id, NOT NULL | المحكمة الأم |
| `circuit_no` | `varchar(50)` | NOT NULL | رقم/تسمية الدائرة (نص حر: الأولى، 1، أ) |
| `circuit_name` | `varchar(150)` | NULL | اسم وصفي اختياري |
| `is_active` | `boolean` | NOT NULL, default `true` | |
| `created_by` | `bigint` | FK → users.id, NOT NULL | |
| `created_at` | `timestamp` | NOT NULL | |
| `updated_by` | `bigint` | FK → users.id, NULL | |
| `updated_at` | `timestamp` | NULL | |

قيد فريد: `UNIQUE(court_id, circuit_no)` — لا تتكرر الدائرة داخل نفس المحكمة.
عند حذف المحكمة (وهو ممنوع فعلياً — انظر §3): `ON DELETE RESTRICT`.

---

## 2. الصلاحيات

الوصول محصور في دورين:

| الدور | المستخدم | نوع الصلاحية |
|---|---|---|
| مدير النظام | سليمان الصالحي | أصيل — كامل الصلاحيات |
| مشرف القسم | عبدالرحمن النفيعي | بالتفويض — يُمنح/يُسحب من سليمان |

- التفويض يُدار عبر صلاحية مسمّاة `courts.manage` مربوطة بالمستخدم، لا بالدور، لتسمح بالمنح الفردي.
- أي مستخدم بدون `courts.manage` لا يصل لأي endpoint في هذه الوحدة (قراءة أو كتابة على مستوى الإدارة). القراءة لأغراض الاختيار عند تسجيل العقار تُخدم عبر endpoint عام منفصل (§4.7).

---

## 3. قواعد العمل

1. **لا حذف نهائي.** لا توجد عملية delete على المحاكم أو الدوائر. الإيقاف يتم عبر `is_active = false` فقط. هذا يحمي أي طلب/عقار سابق مرتبط بالسجل.

2. **المحكمة المعطّلة** (`is_active = false`) لا تظهر في قائمة الاختيار عند تسجيل العقارات الجديدة، لكنها تبقى مقروءة في السجلات القديمة المرتبطة بها.

3. **الدائرة المعطّلة** لا تظهر في قائمة دوائر المحكمة عند الاختيار، مع بقائها في السجلات القديمة.

4. **الربط لحظة الاختيار، لا بالمرجع الحي.** عند تسجيل العقار يُخزَّن `court_id` و `circuit_id` كمرجع، لكن اسم المحكمة والدائرة يُنسخان (snapshot) في سجل العقار. تعديل اسم المحكمة لاحقاً لا يغيّر البيانات المسجّلة في العقارات القديمة.

5. **تعطيل المحكمة لا يعطّل دوائرها في البيانات** — لكن منطق الاختيار يمنع الوصول للدوائر عبر محكمة معطّلة أصلاً (لا تظهر المحكمة إطلاقاً).

6. **الاسم فريد داخل المدينة** — يُرفض الإنشاء عند تكرار `(name, city)`.

7. **كل عملية كتابة تُسجَّل في سجل التدقيق** (§5).

---

## 4. الـ Endpoints (الإدارة)

جميعها تتطلب صلاحية `courts.manage`.

### 4.1 قائمة المحاكم
```
GET /api/admin/courts
Query: ?search=&status=all|active|inactive&region=&city=&page=&limit=
Response: { data: Court[], total, page, limit }
```
كل عنصر Court يتضمن `circuits_count`.

### 4.2 تفاصيل محكمة + دوائرها
```
GET /api/admin/courts/:id
Response: { ...Court, circuits: Circuit[] }
```

### 4.3 إنشاء محكمة
```
POST /api/admin/courts
Body: { name, region, city, is_active }
Rules: validate uniqueness (name, city)
Response: 201 { ...Court }
Audit: COURT_CREATED
```

### 4.4 تعديل محكمة
```
PUT /api/admin/courts/:id
Body: { name?, region?, city?, is_active? }
Rules: re-validate uniqueness if name/city changed
Response: 200 { ...Court }
Audit: COURT_UPDATED (يسجّل الحقول المتغيرة قبل/بعد)
```

### 4.5 تبديل حالة المحكمة
```
PATCH /api/admin/courts/:id/status
Body: { is_active }
Response: 200 { id, is_active }
Audit: COURT_ACTIVATED | COURT_DEACTIVATED
```

### 4.6 إدارة الدوائر
```
POST   /api/admin/courts/:courtId/circuits
Body: { circuit_no, circuit_name?, is_active }
Rules: validate uniqueness (court_id, circuit_no)
Audit: CIRCUIT_CREATED

PUT    /api/admin/courts/:courtId/circuits/:id
Body: { circuit_no?, circuit_name?, is_active? }
Audit: CIRCUIT_UPDATED

PATCH  /api/admin/courts/:courtId/circuits/:id/status
Body: { is_active }
Audit: CIRCUIT_ACTIVATED | CIRCUIT_DEACTIVATED
```

### 4.7 القراءة العامة (للاختيار عند تسجيل العقار)
لا تتطلب `courts.manage` — متاحة لأدوار تسجيل العقار. تُرجع الفعّال فقط.
```
GET /api/courts/selectable
Query: ?region=&city=
Response: Court[] where is_active = true

GET /api/courts/:id/circuits/selectable
Response: Circuit[] where is_active = true AND court is_active = true
```

---

## 5. سجل التدقيق (Audit Log)

كل عملية كتابة تُنشئ قيداً في `audit_log`:

| الحقل | القيمة |
|---|---|
| `action` | من قائمة الأحداث أدناه |
| `entity_type` | `court` \| `circuit` |
| `entity_id` | المعرّف |
| `actor_id` | المستخدم المنفّذ |
| `changes` | JSON: `{ field: { before, after } }` |
| `timestamp` | وقت التنفيذ |

أحداث: `COURT_CREATED`, `COURT_UPDATED`, `COURT_ACTIVATED`, `COURT_DEACTIVATED`, `CIRCUIT_CREATED`, `CIRCUIT_UPDATED`, `CIRCUIT_ACTIVATED`, `CIRCUIT_DEACTIVATED`.

---

## 6. التحقق (Validation)

| الحقل | القاعدة | رسالة الخطأ |
|---|---|---|
| `name` | مطلوب، 2–150 حرف | اسم المحكمة مطلوب |
| `region` | مطلوب، ضمن قائمة المناطق المعتمدة | المنطقة غير صحيحة |
| `city` | مطلوب، تابعة للمنطقة | المدينة غير صحيحة |
| `(name, city)` | فريد | توجد محكمة بنفس الاسم في هذه المدينة |
| `circuit_no` | مطلوب، 1–50 حرف | رقم الدائرة مطلوب |
| `(court_id, circuit_no)` | فريد | الدائرة مكرّرة في هذه المحكمة |

---

## 7. TypeScript Interfaces

```typescript
interface Court {
  id: number;
  name: string;
  region: string;
  city: string;
  isActive: boolean;
  circuitsCount?: number;
  createdBy: number;
  createdAt: string;
  updatedBy?: number;
  updatedAt?: string;
}

interface Circuit {
  id: number;
  courtId: number;
  circuitNo: string;
  circuitName?: string;
  isActive: boolean;
  createdBy: number;
  createdAt: string;
  updatedBy?: number;
  updatedAt?: string;
}

// Snapshot المخزّن في سجل العقار
interface CourtAssignmentSnapshot {
  courtId: number;
  courtName: string;    // منسوخ لحظة الاختيار
  circuitId: number;
  circuitNo: string;    // منسوخ لحظة الاختيار
  circuitName?: string;
  assignedAt: string;
  assignedBy: number;
}
```
