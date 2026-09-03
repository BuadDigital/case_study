import type { CSSProperties, ReactNode } from "react";

export function Auto({ children, colSpan }: { children: ReactNode; colSpan?: number }) {
  return (
    <td className="v auto" colSpan={colSpan}>
      {children}
    </td>
  );
}

export function K({
  children,
  nowrap = true,
  style,
}: {
  children: ReactNode;
  nowrap?: boolean;
  style?: CSSProperties;
}) {
  return (
    <td className="k" style={{ ...(nowrap ? null : { whiteSpace: "normal" }), ...style }}>
      {children}
    </td>
  );
}

export function Sec({
  n,
  title,
  open,
  onToggle,
  children,
}: {
  n: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="sec">
      <h2 className="rpt-h" onClick={onToggle}>
        <span className="n">{n}</span>
        {title}
        <span className={open ? "chev" : "chev is-closed"}>▾</span>
      </h2>
      {open ? children : null}
    </section>
  );
}

/** Item tables 06–11 as in settings v2 — gray cells = field source. */
export function ReportSourceTables({
  isOpen,
  toggle,
  finishing,
}: {
  isOpen: (n: string) => boolean;
  toggle: (n: string) => void;
  finishing?: ReactNode;
}) {
  return (
    <>
      <section className="rpt-page">
        <Sec n="06" title="الأصل محل التقييم" open={isOpen("06")} onToggle={() => toggle("06")}>
          <p className="sysnote">
            حقول هذا البند — مصدر كل حقل مبيّن أمامه: من النظام / إدخال / اختيار من قائمة.
          </p>
          <table>
            <tbody>
              <tr>
                <K>نوع العقار</K>
                <Auto>من النظام — حقل «نوع العقار» في المعاملة</Auto>
                <K>حالة العقار</K>
                <Auto>يُختار من قائمة «حالة العقار» المرجعية</Auto>
              </tr>
              <tr>
                <K>وصف العقار</K>
                <Auto colSpan={3}>إدخال — يكتبه المعاين أو الأخصائي</Auto>
              </tr>
              <tr>
                <K>نوع الملكية</K>
                <Auto colSpan={3}>
                  يُختار: ملكية مطلقة / مشاع — وعند اختيار «مشاع» يُحدَّد نطاق التقييم: كامل العقار
                  المشاع، أو حصة مالك معين
                </Auto>
              </tr>
              <tr>
                <K>تقييم الملكية المشاعة بنسبة (٪)</K>
                <Auto colSpan={3}>
                  إدخال — يظهر عند اختيار «مشاع»: تُقيَّم قيمة العقار كاملاً ثم تُحسب قيمة النسبة
                  المدخلة (مثلاً 24%)
                </Auto>
              </tr>
            </tbody>
          </table>
          <table>
            <tbody>
              <tr>
                <K>هل يوجد منقولات</K>
                <Auto>إدخال — نعم / لا</Auto>
                <K>وصف المنقولات</K>
                <Auto>إدخال — يظهر عند اختيار «نعم»</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec n="07" title="تفاصيل موقع العقار" open={isOpen("07")} onToggle={() => toggle("07")}>
          <p className="sysnote">
            حقول هذا البند — مصدر كل حقل مبيّن أمامه: من النظام / إدخال / اختيار من قائمة.
          </p>
          <table>
            <tbody>
              <tr>
                <K>اسم المنطقة</K>
                <Auto>يُختار من قائمة مناطق المملكة المرجعية</Auto>
                <K>اسم المدينة</K>
                <Auto>يُختار من قائمة مدن المنطقة</Auto>
                <K>اسم الحي</K>
                <Auto>يُختار من قائمة أحياء المدينة</Auto>
              </tr>
              <tr>
                <K>اسم المخطط</K>
                <Auto>إدخال — من الصك أو المخطط</Auto>
                <K>رقم المخطط</K>
                <Auto>إدخال — من الصك أو المخطط</Auto>
                <K>رقم البلك</K>
                <Auto>إدخال — من الصك أو المخطط</Auto>
              </tr>
              <tr>
                <K>رقم القطعة</K>
                <Auto>إدخال</Auto>
                <K>استخدام العقار</K>
                <Auto>يُختار من قائمة «استخدامات العقار»</Auto>
                <K>إحداثيات الموقع</K>
                <Auto>من النظام — تحديد المعاين للموقع</Auto>
              </tr>
              <tr>
                <K>اسم المالك</K>
                <Auto>من النظام — حقل «اسم المالك»</Auto>
                <K>رقم الصك</K>
                <Auto>من النظام — بيانات الصك في المعاملة</Auto>
                <K>تاريخ الصك</K>
                <Auto>من النظام — بيانات الصك في المعاملة</Auto>
              </tr>
              <tr>
                <K>رقم رخصة البناء</K>
                <Auto>إدخال — من رخصة البناء</Auto>
                <K>تاريخ رخصة البناء</K>
                <Auto>إدخال — من رخصة البناء</Auto>
                <K>عمر البناء</K>
                <Auto>إدخال — يقدّره المعاين</Auto>
              </tr>
              <tr>
                <K>محضر التجزئة</K>
                <Auto>إدخال — إن وجد</Auto>
                <K>حالة البناء</K>
                <Auto>إدخال — يدوّنه المعاين</Auto>
                <K>حالة الإشغال</K>
                <Auto>يُختار من قائمة «حالات الإشغال»</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec n="08" title="حدود وأطوال العقار" open={isOpen("08")} onToggle={() => toggle("08")}>
          <p className="sysnote">
            حقول هذا البند — مصدر كل حقل مبيّن أمامه: من النظام / إدخال / اختيار من قائمة.
          </p>
          <table className="mx">
            <thead>
              <tr>
                <th style={{ width: "18%" }}>الجهة</th>
                <th>الحد</th>
                <th style={{ width: "18%" }}>طول الضلع</th>
                <th style={{ width: "22%" }}>الواجهات</th>
              </tr>
            </thead>
            <tbody>
              {["الشمالية", "الجنوبية", "الشرقية", "الغربية"].map((side) => (
                <tr key={side}>
                  <td className="v">{side}</td>
                  <Auto>إدخال</Auto>
                  <Auto>إدخال</Auto>
                  <Auto>إدخال</Auto>
                </tr>
              ))}
            </tbody>
          </table>
        </Sec>
        <Sec n="09" title="تفاصيل المساحات" open={isOpen("09")} onToggle={() => toggle("09")}>
          <p className="sysnote">
            حقول هذا البند — مصدر كل حقل مبيّن أمامه: من النظام / إدخال / اختيار من قائمة.
          </p>
          <table>
            <tbody>
              <tr>
                <K>مساحة الأرض</K>
                <Auto>إدخال — من الصك أو الرفع المساحي أو الحصر الميداني</Auto>
              </tr>
            </tbody>
          </table>
          <table className="mx">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>البيان — الحصر الميداني</th>
                <th>المساحة (م²)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Auto>إدخال — يضيف المستخدم الأدوار بحرية (مثل: الدور الأرضي)</Auto>
                <Auto>إدخال</Auto>
              </tr>
              <tr>
                <Auto>إدخال — سطر لكل دور، تزيد الأدوار أو تنقص حسب العقار</Auto>
                <Auto>إدخال</Auto>
              </tr>
              <tr>
                <Auto>+ إضافة دور / حذف دور</Auto>
                <td className="v" />
              </tr>
              <tr className="total">
                <td className="v">مجموع مسطحات البناء</td>
                <Auto>يُحسب تلقائيًا من مجموع الأدوار المدخلة</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
      </section>

      <section className="rpt-page">
        <Sec n="10" title="تفاصيل البناء" open={isOpen("10")} onToggle={() => toggle("10")}>
          <p className="sysnote">
            حقول هذا البند — مصدر كل حقل مبيّن أمامه: من النظام / إدخال / اختيار من قائمة.
          </p>
          <table>
            <tbody>
              <tr>
                <K>رقم رخصة البناء</K>
                <Auto>إدخال</Auto>
                <K>تاريخ رخصة البناء</K>
                <Auto>إدخال</Auto>
                <K>عمر البناء</K>
                <Auto>إدخال</Auto>
              </tr>
              <tr>
                <K>رقم محضر التجزئة</K>
                <Auto>إدخال</Auto>
                <K>حالة البناء</K>
                <Auto>إدخال</Auto>
                <K>حالة الاشغال</K>
                <Auto>إدخال</Auto>
              </tr>
              <tr>
                <K nowrap={false}>هل العقار مطابق لرخصة البناء</K>
                <Auto colSpan={2}>إدخال — نعم / لا / لم يتم الاطلاع على رخصة البناء</Auto>
                <K>حدود المعاينة</K>
                <Auto colSpan={2}>إدخال — من خارج العقار / من داخل العقار</Auto>
              </tr>
              <tr>
                <td className="k" style={{ whiteSpace: "normal" }} colSpan={2}>
                  في حال عدم مطابقة العقار لرخصة البناء، الرجاء توضيح المخالفات أو أي ملاحظات:
                </td>
                <Auto colSpan={4}>إدخال</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec n="11" title="مكونات العقار" open={isOpen("11")} onToggle={() => toggle("11")}>
          <p className="sysnote">
            حقول هذا البند — مصدر كل حقل مبيّن أمامه: من النظام / إدخال / اختيار من قائمة.
          </p>
          <table>
            <tbody>
              <tr>
                <K>سور</K>
                <Auto>إدخال (اختيار) — يوجد / لا يوجد</Auto>
                <K>مواقف</K>
                <Auto>إدخال (اختيار) — يوجد / لا يوجد</Auto>
                <K>مسبح</K>
                <Auto>إدخال (اختيار) — يوجد / لا يوجد</Auto>
                <K>مصعد</K>
                <Auto>إدخال (اختيار) — يوجد / لا يوجد</Auto>
              </tr>
              <tr>
                <K>تكييف مركزي</K>
                <Auto>إدخال (اختيار) — يوجد / لا يوجد</Auto>
                <K>خزانات</K>
                <Auto>إدخال (اختيار) — يوجد / لا يوجد</Auto>
                <K>تشجير</K>
                <Auto>إدخال (اختيار) — يوجد / لا يوجد</Auto>
                <K>أخرى</K>
                <Auto>إدخال — نص حر إن وجد</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        {finishing}
        <Sec n="13" title="وصف العيوب الإنشائية" open={isOpen("13")} onToggle={() => toggle("13")}>
          <p className="sysnote">
            حقول هذا البند — مصدر كل حقل مبيّن أمامه: من النظام / إدخال / اختيار من قائمة.
          </p>
          <table>
            <tbody>
              <tr>
                <td className="v">
                  <span className="auto">حقل إدخال — بجملة افتراضية قابلة للتعديل: </span>
                  لا توجد عيوب إنشائية ظاهرة وقت المعاينة، وما رُصد ملاحظات صيانة سطحية (دهانات
                  خارجية) لا تؤثر في القيمة.
                </td>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec
          n="14"
          title="الخدمات والمرافق المتوفرة بالعقار"
          open={isOpen("14")}
          onToggle={() => toggle("14")}
        >
          <p className="sysnote">
            حقول هذا البند — مصدر كل حقل مبيّن أمامه: من النظام / إدخال / اختيار من قائمة.
          </p>
          <table className="mx">
            <thead>
              <tr>
                <th style={{ width: "16%" }}>الخدمة</th>
                <th style={{ width: "10%" }}>التوفر</th>
                <th style={{ width: "12%" }}>عدد العدادات</th>
                <th>أرقام العدادات</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="k">كهرباء</td>
                <Auto>إدخال (اختيار) — متوفر / غير متوفر</Auto>
                <Auto>إدخال — رقمي، يظهر عند «متوفر»</Auto>
                <Auto>إدخال — رقم لكل عداد حسب العدد المدخل</Auto>
              </tr>
              <tr>
                <td className="k">ماء</td>
                <Auto>إدخال (اختيار) — متوفر / غير متوفر</Auto>
                <Auto>إدخال — رقمي، يظهر عند «متوفر»</Auto>
                <Auto>إدخال — رقم لكل عداد حسب العدد المدخل</Auto>
              </tr>
              <tr>
                <td className="k">صرف صحي</td>
                <Auto colSpan={3}>إدخال (اختيار) — متوفر / غير متوفر (بلا عدادات)</Auto>
              </tr>
              <tr>
                <td className="k">هاتف / ألياف بصرية</td>
                <Auto colSpan={3}>إدخال (اختيار) — متوفر / غير متوفر (بلا عدادات)</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
      </section>
    </>
  );
}

export function ReportDynamicTables({
  isOpen,
  toggle,
}: {
  isOpen: (n: string) => boolean;
  toggle: (n: string) => void;
}) {
  return (
    <>
      <section className="rpt-page">
        <Sec n="15" title="المحيط المؤثر للعقار" open={isOpen("15")} onToggle={() => toggle("15")}>
          <p className="sysnote">
            حقول هذا البند — مصدر كل حقل مبيّن أمامه: من النظام / إدخال / اختيار من قائمة.
          </p>
          <table>
            <tbody>
              <tr>
                <K>جامع</K>
                <Auto>إدخال (اختيار)</Auto>
                <K>مرفق طبي</K>
                <Auto>إدخال (اختيار)</Auto>
                <K>مرفق أمني</K>
                <Auto>إدخال (اختيار)</Auto>
                <K>سوق تجاري</K>
                <Auto>إدخال (اختيار)</Auto>
              </tr>
              <tr>
                <K>حديقة</K>
                <Auto>إدخال (اختيار)</Auto>
                <K>مرفق تعليمي</K>
                <Auto>إدخال (اختيار)</Auto>
                <K>مقر حكومي</K>
                <Auto>إدخال (اختيار)</Auto>
                <K>طريق سريع</K>
                <Auto>إدخال (اختيار)</Auto>
              </tr>
              <tr>
                <K>أخرى</K>
                <Auto colSpan={7}>إدخال — نص حر إن وجد</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec
          n="16"
          title="أسلوب وطريقة التقييم المستخدمة"
          open={isOpen("16")}
          onToggle={() => toggle("16")}
        >
          <p className="sysnote">
            يختار المقيم في المعاملة الأسلوب ثم الطريقة من قائمة «أساليب وطرق التقييم» في قوائم
            التقييم — لكل أسلوب طرقه.
          </p>
          <table className="mx">
            <thead>
              <tr>
                <th style={{ width: "33%" }}>أسلوب السوق</th>
                <th style={{ width: "33%" }}>أسلوب التكلفة</th>
                <th>أسلوب الدخل</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Auto>إدخال (اختيار) — طريقة من قائمة «أساليب وطرق التقييم» أو «غير مستخدم»</Auto>
                <Auto>إدخال (اختيار) — طريقة من القائمة أو «غير مستخدم»</Auto>
                <Auto>إدخال (اختيار) — طريقة من القائمة أو «غير مستخدم»</Auto>
              </tr>
            </tbody>
          </table>
        </Sec>
        <Sec n="17" title="العقارات المقارنة" open={isOpen("17")} onToggle={() => toggle("17")}>
          <p className="sysnote">
            بند ديناميكي مبرمج — لا يُرسم هنا: يتشكل عند الإدخال وتحسبه برمجة جاهزة، والنظام يطبع
            مخرجاته. أعمدة الجدول من عناوين قائمة «العقارات المقارنة» في قوائم التقييم (عمود لكل
            مقارن — 2 أو أكثر)، ويعبّئ المقيم بيانات كل مقارن حسب مصدر كل عنوان: إدخال / اختيار /
            محسوب (سعر المتر). <strong>شرط الظهور:</strong> يُطبع فقط إذا اختيرت طريقة المقارنة.
          </p>
        </Sec>
        <Sec n="18" title="خريطة مواقع المقارنات" open={isOpen("18")} onToggle={() => toggle("18")}>
          <div className="map-ph">خريطة مواقع المقارنات — اسحب الصورة هنا</div>
        </Sec>
      </section>

      <section className="rpt-page">
        <Sec n="19" title="جدول التسويات" open={isOpen("19")} onToggle={() => toggle("19")}>
          <p className="sysnote">
            بند ديناميكي مبرمج — لا يُرسم هنا: الجدول يتشكل عند الإدخال (عمود لكل مقارن، 2 أو أكثر)،
            والعمليات الحسابية يجريها محرك حساب جاهز والنظام يطبع مخرجاته. صفوف التسوية من قائمة
            عوامل التسوية، ومبررات كل تسوية نص افتراضي قابل للتعديل.{" "}
            <strong>شرط الظهور:</strong> يُطبع فقط إذا اختيرت طريقة المقارنة — وسقوطه يعيد ترقيم
            البنود تلقائيًا.
          </p>
        </Sec>
      </section>

      <section className="rpt-page">
        <Sec
          n="20"
          title="قيمة الأرض (أسلوب التكلفة)"
          open={isOpen("20")}
          onToggle={() => toggle("20")}
        >
          <p className="sysnote">
            بند ديناميكي مبرمج — لا يُرسم هنا. سعر متر الأرض من مقارنات أراضٍ شاغرة مجاورة،
            والمساحة من النظام (الصك). <strong>شرط الظهور:</strong> يُطبع فقط إذا اختير أسلوب
            التكلفة.
          </p>
        </Sec>
        <Sec n="21" title="بنود التكلفة المباشرة" open={isOpen("21")} onToggle={() => toggle("21")}>
          <p className="sysnote">
            بند ديناميكي مبرمج — الصفوف تتبع مكونات البناء المدخلة، وأسعار المتر إدخال المقيم.{" "}
            <strong>شرط الظهور:</strong> أسلوب التكلفة + عقار مبني.
          </p>
        </Sec>
        <Sec n="22" title="التكاليف غير المباشرة" open={isOpen("22")} onToggle={() => toggle("22")}>
          <p className="sysnote">
            بند ديناميكي مبرمج — نسب افتراضية قابلة للتعديل لكل بند، والإجمالي محسوب.{" "}
            <strong>شرط الظهور:</strong> أسلوب التكلفة + عقار مبني.
          </p>
        </Sec>
      </section>

      <section className="rpt-page">
        <Sec n="23" title="العمر والإهلاك" open={isOpen("23")} onToggle={() => toggle("23")}>
          <p className="sysnote">
            بند ديناميكي مبرمج — الأعمار إدخال المقيم، والتقادم والإهلاك وناتج أسلوب التكلفة
            محسوبة. <strong>شرط الظهور:</strong> أسلوب التكلفة + عقار مبني.
          </p>
        </Sec>
        <Sec n="24" title="ترجيح أساليب التقييم" open={isOpen("24")} onToggle={() => toggle("24")}>
          <p className="sysnote">
            بند ديناميكي مبرمج — صف لكل أسلوب مستخدم، ونسب المشاركة إدخال المقيم (مجموعها 100٪).
            مبرر استخدام الطرق نص افتراضي قابل للتعديل. <strong>شرط الظهور:</strong> يظهر فقط عند
            استخدام أكثر من أسلوب.
          </p>
        </Sec>
        <Sec n="25" title="القيمة النهائية للعقار" open={isOpen("25")} onToggle={() => toggle("25")}>
          <p className="sysnote">
            بند ديناميكي مبرمج — قيمه نتيجة حسابات التقييم (القيمة المرجّحة من البند 24، وخصم
            التصفية إن كان أساس القيمة التصفية)، والقيمة النهائية وتفقيطها محسوبان، وتُطبع في
            الشريط الكحلي الختامي.
          </p>
        </Sec>
      </section>
    </>
  );
}
