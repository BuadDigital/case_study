var PAGES = {
    'المعاملات النشطة': { stats:[[41,'معاملات نشطة','قيد المعالجة'],[9,'استعلام بورصة',''],[12,'التوزيع',''],[20,'دراسة الحالة','']],
      cols:[{label:'رقم المعاملة',first:true},{label:'العقار / الصك'},{label:'المرحلة'},{label:'المتبقي'},{label:'الحالة'},{label:'الأخصائي'}],
      rows:[
        ['TX-5012','صك 10203040506','دراسة الحالة','يومان',pill('قيد العمل',GOLD),'أسامة الصالحي'],
        ['TX-5011','صك 88120044991','المراجعة الحكومية','٣ أيام',pill('قيد العمل',GOLD),'عبدالله الكثيري'],
        ['TX-5009','صك 45500213366','البورصة','متأخر',pill('متعذر',RED),'تركي'],
        ['TX-5006','صك 90011223344','التوزيع','١ يوم',pill('قيد العمل',GOLD),'عمر'],
        ['TX-5001','صك 55667788990','دراسة الحالة','٤ أيام',pill('قيد العمل',GOLD),'عثمان']
      ] },
    'مكاتب الرفع الهندسي': { stats:[[16,'إجمالي طلبات الرفع',''],[9,'مكتملة',''],[5,'قيد التنفيذ',''],[2,'لم تُسند','']],
      cols:[{label:'اسم المكتب',first:true},{label:'نشطة',center:true},{label:'مكتملة هذا الشهر',center:true},{label:'متوسط الإنجاز',center:true},{label:'آلية التعاقد'},{label:'الحالة'}],
      rows:[
        ['مكتب جدة للمساحة','5','12','2.8 يوم',pill('عقد سنوي',GRAY),pill('نشط',GREEN)],
        ['مكتب مكة الهندسي','4','9','3.1 يوم',pill('عقد سنوي',GRAY),pill('نشط',GREEN)],
        ['مكتب الرياض للرفع','3','7','3.9 يوم',pill('بالطلب',GRAY),pill('مشغول',AMBER)],
        ['مكتب الطائف','2','4','4.2 يوم',pill('بالطلب',GRAY),pill('نشط',GREEN)],
        ['مكتب الدمام','0','3','—',pill('عقد سنوي',GRAY),pill('نشط',GREEN)]
      ] },
    'إدارة المفاتيح': { stats:[[27,'إجمالي المفاتيح',''],[18,'مستلمة',''],[6,'بانتظار الاستلام',''],[3,'تعذرات مفاتيح','']],
      cols:[{label:'الصك',first:true},{label:'حالة الصك'},{label:'المنطقة'},{label:'المحكمة'},{label:'حالة المفتاح'},{label:'تعذر المفتاح'},{label:'المندوب'},{label:'إجراء'}],
      rows:[
        ['صك 10203040506',pill('فعال',GREEN),'العزيزية','محكمة التنفيذ بمكة',pill('مستلم',GREEN),pill('لا يوجد',GRAY),'عبدالله عبدالمانع','—'],
        ['صك 88120044991',pill('قيد التحقق',AMBER),'الشرفية','محكمة التنفيذ بجدة',pill('بانتظار الاستلام',AMBER),pill('لا يوجد',GRAY),'—','<button class="btn-ghost" style="padding:5px 12px;font-size:12px">تسجيل الاستلام</button>'],
        ['صك 45500213366',pill('موقوف',RED),'النسيم','محكمة التنفيذ بالرياض',pill('بانتظار الاستلام',AMBER),pill('متعذر',RED),'—','<button class="btn-ghost" style="padding:5px 12px;font-size:12px">تسجيل الاستلام</button>'],
        ['صك 77341122008',pill('فعال',GREEN),'السلامة','محكمة التنفيذ بجدة',pill('مستلم',GREEN),pill('سابق',AMBER),'المكتب الهندسي','—']
      ] },
    'إدارة التعذرات': { stats:[[3,'تعذرات مفتوحة','تحتاج معالجة'],[2,'عند مشرف دراسة الحالة','بانتظار الاعتماد'],[12,'معتمدة / تم الحل','80% من الإجمالي'],[20,'الإجمالي','سجلات التعذر']],
      cols:[{label:'الصك',first:true},{label:'أمر العمل'},{label:'الخطورة'},{label:'الحالة'},{label:'الرافع'},{label:'الأخصائي'}],
      rows:[
        ['صك 45500213366','PO-2026-0005','مؤكد',pill('مفتوح',RED),'معاين ميداني','تركي'],
        ['صك 33445566778','PO-2026-0010','مؤكد',pill('مراجعة',AMBER),'مراجع حكومي','عثمان'],
        ['صك 90011223344','PO-2026-0011','احتمال',pill('داخلي',NAVY),'مقيم عقاري','عمر'],
        ['صك 55667788990','PO-004','مؤكد',pill('معتمد',GREEN),'أخصائي دراسة','أيمن مجرشي'],
        ['صك 12009887654','PO-002','احتمال',pill('تم الحل',GREEN),'أخصائي دراسة','—']
      ] },
    'المعاملات المعلقة': { stats:[[4,'معاملات معلقة','بانتظار رفع التعليق'],[1,'متأخرة عن الاستحقاق','تجاوزت الموعد'],[3,'ضمن المهلة','75% من الإجمالي'],[4,'الإجمالي','عقارات موقوفة مؤقتاً']],
      cols:[{label:'رقم الصك',first:true},{label:'أمر العمل'},{label:'نوع الإسناد'},{label:'أخصائي الإسناد'},{label:'الحالة'}],
      rows:[
        ['صك 12009887654','PO-002','تركات','—',pill('يومان',GOLD)],
        ['صك 66778899001','PO-2026-7','تركات','عبدالله الكثيري',pill('٥ أيام',GOLD)],
        ['صك 22334455667','PO-2026-0011','تنفيذ','عمر',pill('متأخر',RED)],
        ['صك 99887766554','PO-004','تنفيذ','أيمن مجرشي',pill('يومان',GOLD)]
      ] },
    'طلبات التقييم': { stats:[[18,'طلبات نشطة',''],[9,'مكتملة',''],[7,'قيد التنفيذ',''],[2,'متعذرة','']],
      cols:[{label:'رقم الطلب',first:true},{label:'العقار'},{label:'المنطقة'},{label:'النوع'},{label:'المقيم المُسند'},{label:'الحالة'},{label:'التاريخ'},{label:'إجراء'}],
      rows:[
        ['VR-441','صك 10203040506','مكة — العزيزية','فيلا','عبدالله الكثيري',pill('قيد التنفيذ',GOLD),'28/06/2026','<button class="btn-ghost" style="padding:5px 12px;font-size:12px">عرض</button>'],
        ['VR-438','صك 88120044991','جدة — الشرفية','عمارة','محمد دياب',pill('مكتمل',GREEN),'27/06/2026','—'],
        ['VR-435','صك 45500213366','الرياض — النسيم','أرض','عبدالله الكثيري',pill('مكتمل',GREEN),'26/06/2026','—'],
        ['VR-432','صك 77341122008','جدة — السلامة','شقة','محمد دياب',pill('قيد التنفيذ',GOLD),'25/06/2026','<button class="btn-ghost" style="padding:5px 12px;font-size:12px">عرض</button>'],
        ['VR-430','صك 33445566778','الطائف — شهار','مجمع','—',pill('متعذر',RED),'24/06/2026','—']
      ] },
    'الأتعاب والصرف': { stats:[[22,'إجمالي المطالبات',''],[6,'رفعت للمشرف',''],[9,'معتمدة للمالية',''],[7,'مصروفة','']],
      cols:[{label:'المعاملة',first:true},{label:'أمر العمل'},{label:'الصافي (ر.س)'},{label:'حالة العمل'},{label:'حالة الدفع'},{label:'إجراء'}],
      rows:[
        ['فيلا — العزيزية','PO-004','٨٬٥٠٠',pill('مكتمل',GREEN),pill('عند المالية',AMBER),'<button class="btn-ghost" style="padding:5px 12px;font-size:12px">صرف</button>'],
        ['عمارة — الشرفية','PO-2026-7','٦٬٢٠٠',pill('مكتمل',GREEN),pill('طلب صرف',NAVY),'<button class="btn-ghost" style="padding:5px 12px;font-size:12px">صرف</button>'],
        ['أرض — النسيم','PO-2026-0005','٣٬٢٠٠',pill('قيد العمل',GOLD),pill('عند المكتب',GRAY),'—'],
        ['مجمع — السلامة','PO-2026-0011','٤٬٠٠٠',pill('مكتمل',GREEN),pill('مصروف',GREEN),'—'],
        ['شقة — الشوقية','PO-002','٢٬٧٥٠',pill('مكتمل',GREEN),pill('معاد للمكتب',RED),'<button class="btn-ghost" style="padding:5px 12px;font-size:12px">إعادة الإرسال</button>']
      ] }
  };

  function goPoList(){
    setHeader('أوامر العمل (PO)', crumb(['لوحة التحكم','دراسة الحالة','أوامر العمل']));
    navActive('أوامر العمل (PO)');
    showView('po');
  }

  /* ═══════════ طبقة المهام (Tasks) ═══════════ */
  var ASSIGNEES = [
    { id:'u1', name:'بندر السلمي', role:'مراجع حكومي' },
    { id:'u2', name:'تركي الدوسري', role:'معاين ميداني' },
    { id:'u3', name:'عمر الشمري', role:'مندوب ميداني' },
    { id:'u4', name:'محمد دياب', role:'مقيم عقاري' },
    { id:'u5', name:'عبدالله الكثيري', role:'أخصائي دراسة' }
  ];
  var TASK_TYPES = {
    court_visit:{ label:'زيارة محكمة', letter:true, ico:'<path d="M3 21h18M6 21V10M18 21V10M4 10h16L12 3z"/><path d="M9 21v-5h6v5"/>' },
    reshoot:{ label:'إعادة تصوير', ico:'<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15"/>' },
    field_visit:{ label:'زيارة ميدانية', ico:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' },
    inquiry:{ label:'استفسار', ico:'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>' },
    general:{ label:'مهمة عامة', ico:'<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/><path d="M9 11l3 3L22 4"/>' }
  };
  var TASK_SCOPES = { transaction:'معاملة', work_order:'أمر عمل', multi:'عدة معاملات', general:'عامة' };
  var TASK_STATUS = { created:{t:'منشأة',c:NAVY}, in_progress:{t:'قيد التنفيذ',c:GOLD}, paused:{t:'متوقفة مؤقتاً',c:'#8a8d96'}, completed:{t:'مكتملة',c:GREEN}, cancelled:{t:'ملغاة',c:RED} };
  var TASK_TERMINAL = { completed:1, cancelled:1 };
  function taskActive(t){ return t.status==='created'||t.status==='in_progress'; }
  var TASK_PRIORITY = { high:{t:'عالية',c:'#d9694f',off:4*3600000}, medium:{t:'متوسطة',c:'#d9a441',off:DAY/2}, low:{t:'منخفضة',c:'#8a8d96',off:DAY} };
  var TASK_REMIND = { high:{label:'كل ساعة ضمن الدوام'}, medium:{label:'مراجعة منتصف/نهاية الدوام'}, low:{label:'مراجعة يوم العمل التالي'} };
  var WH_START=8, WH_END=17, WH_NOON=12;
  function isWorkDay(d){ var g=d.getDay(); return g>=0 && g<=4; } // الأحد–الخميس
  function atHour(d,h){ return new Date(d.getFullYear(),d.getMonth(),d.getDate(),h,0,0,0).getTime(); }
  function nextWorkDayNoon(ts){ var d=new Date(ts); do{ d.setDate(d.getDate()+1); }while(!isWorkDay(d)); return atHour(d,WH_NOON); }
  function nextCheckpoint(ts){
    var d=new Date(ts), h=d.getHours()+d.getMinutes()/60;
    if(isWorkDay(d)){ if(h < WH_NOON) return atHour(d,WH_NOON); if(h < WH_END) return atHour(d,WH_END); }
    return nextWorkDayNoon(ts);
  }
  function nextWorkHour(ts){
    var d=new Date(ts);
    if(isWorkDay(d) && d.getHours() < WH_START) return atHour(d,WH_START);
    var cand=new Date(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours()+1,0,0,0);
    if(isWorkDay(cand) && cand.getHours()>=WH_START && cand.getHours()<=WH_END) return cand.getTime();
    var nd=new Date(ts); do{ n