-- ============================================================
-- نظام إجادة — وحدة المواقع (المناطق / المدن / الأحياء)
-- مخطط مرجعي — يُعدَّل بما يوافق طبقة الترحيل (Migrations) المعتمدة
-- charset: utf8mb4 / collation: utf8mb4_unicode_ci
-- ============================================================

-- ---------- المناطق (13) ----------
CREATE TABLE regions (
  id              INT PRIMARY KEY,                 -- 1..13 (الترقيم الإداري)
  code            VARCHAR(4)  NOT NULL UNIQUE,     -- RD, MK, ...
  admin_area_id   INT         NOT NULL UNIQUE,     -- معرّف المصدر الرسمي (العنوان الوطني)
  name_ar         VARCHAR(100) NOT NULL,
  capital_ar      VARCHAR(100) NOT NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE
);

-- ---------- المدن (3077) ----------
CREATE TABLE cities (
  id              INT PRIMARY KEY,                 -- المعرّف الرسمي كما هو — لا يُعاد ترقيمه
  region_id       INT         NOT NULL,
  name_ar         VARCHAR(150) NOT NULL,
  name_en         VARCHAR(150) NULL,
  name_search     VARCHAR(150) NOT NULL,           -- مُطبَّع — انظر §4 في المواصفة
  is_governorate  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_capital      BOOLEAN     NOT NULL DEFAULT FALSE,

  status          ENUM('approved','pending','merged') NOT NULL DEFAULT 'approved',
  raw_input       VARCHAR(150) NULL,               -- النص كما أدخله المستخدم — لا يُعدَّل
  created_by      INT         NULL,
  created_at      TIMESTAMP   NULL,
  reviewed_by     INT         NULL,
  reviewed_at     TIMESTAMP   NULL,
  merged_into     INT         NULL,
  duplicate_of    INT         NULL,                -- تكرار في المصدر الرسمي
  usage_count     INT         NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,

  CONSTRAINT fk_cities_region      FOREIGN KEY (region_id)   REFERENCES regions(id),
  CONSTRAINT fk_cities_merged      FOREIGN KEY (merged_into) REFERENCES cities(id),
  CONSTRAINT fk_cities_created_by  FOREIGN KEY (created_by)  REFERENCES users(id),
  CONSTRAINT fk_cities_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id),

  INDEX idx_cities_region_gov (region_id, is_governorate),
  INDEX idx_cities_search     (name_search),
  INDEX idx_cities_status     (status)
);
-- ⚠️ لا يوجد UNIQUE(region_id, name_ar) — المصدر يحوي أسماء متكررة لقرى مختلفة

-- ---------- الأحياء (يبدأ فارغاً) ----------
CREATE TABLE districts (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  city_id         INT         NOT NULL,
  name_ar         VARCHAR(150) NOT NULL,
  name_search     VARCHAR(150) NOT NULL,

  status          ENUM('approved','pending','merged') NOT NULL DEFAULT 'pending',
  raw_input       VARCHAR(150) NULL,
  created_by      INT         NULL,
  created_at      TIMESTAMP   NULL,
  reviewed_by     INT         NULL,
  reviewed_at     TIMESTAMP   NULL,
  merged_into     INT         NULL,
  usage_count     INT         NOT NULL DEFAULT 0,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,

  CONSTRAINT fk_districts_city        FOREIGN KEY (city_id)     REFERENCES cities(id),
  CONSTRAINT fk_districts_merged      FOREIGN KEY (merged_into) REFERENCES districts(id),
  CONSTRAINT fk_districts_created_by  FOREIGN KEY (created_by)  REFERENCES users(id),
  CONSTRAINT fk_districts_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id),

  INDEX idx_districts_city_status (city_id, status),
  INDEX idx_districts_search      (name_search)
);

-- ============================================================
-- ملاحظات
-- 1) الصفقة تخزّن city_id / district_id — لا النص. تعديل الاسم أو دمجه
--    ينعكس تلقائياً على كل الصفقات السابقة.
-- 2) لا حذف نهائي — الدمج يضبط status='merged' و is_active=false.
-- 3) name_search يُولَّد آلياً عند الإنشاء والتعديل (قواعد التطبيع في المواصفة).
-- 4) ترتيب الاستيراد: regions ← cities ← districts.
-- ============================================================
