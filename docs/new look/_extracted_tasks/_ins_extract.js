var INS_FEATURES=[['الأصل محل التقييم','فيلا',['فيلا','أرض','شقة','عمارة','محل تجاري','مستودع'],false],
    ['الواجهة','شمالية',['شمالية','جنوبية','شرقية','غربية','شمالية غربية','شمالية شرقية','جنوبية غربية','جنوبية شرقية'],false],
    ['استخدام العقار','سكني',['سكني','تجاري','زراعي','صناعي'],true],
    ['حالة منطقة العقار','غير موقوفة',['غير موقوفة','موقوفة'],false],
    ['حالة البناء','جيد',['جيد','متوسط','رديء'],true],
    ['حالة الإشغال','شاغر',['شاغر','مشغول'],false],
    ['حالة الحي','متوسط',['جديد','متوسط','قديم'],false],
    ['يوجد منقولات','لا',['نعم','لا'],false],
    ['مدخل السيارة','نعم',['نعم','لا'],false],
    ['يوجد قبو','لا',['نعم','لا'],false],
    ['يوجد مصعد','نعم',['نعم','لا'],false],
    ['يوجد مسبح','نعم',['نعم','لا'],false],
    ['مطبخ','نعم',['نعم','لا'],false]];
  var INS_COMPONENTS=[['عدد الغرف','5'],['عدد الصالات','2'],['عدد الشقق','1'],['عدد دورات المياه','4'],['عدد المعارض','0'],['عدد الآبار','1'],['عدد الأبراج','0'],['عمر العقار (سنوات)','6']];
  var INS_AREAS=[['مساحة البناء (م²)','420'],['عدد أدوار المباني','2'],['إجمالي مساحة القبو (م²)','0'],['إجمالي مساحة اللاحق (م²)','60'],['إجمالي مساحة المباني (م²)','480']];
  var INS_BOUNDS=[['الحد الشمالي','شارع عرض 15 م','25.0',true,''],['الحد الجنوبي','جار — قطعة 42','30.0',true,''],['الحد الشرقي','شارع عرض 10 م','25.0',false,'الطول الفعلي 24.2 م بفارق ناقص عن الصك'],['الحد الغربي','جار — قطعة 40','30.0',true,'']];
  var INS_SERVICES=['كهرباء','ماء','صرف صحي','هاتف / اتصالات','سفلتة','إنارة'];
  var INS_SERVICES_ON=['كهرباء','ماء','صرف صحي','سفلتة','إنارة'];
  var INS_AMENITIES=['مدارس','مستشفيات','مساجد','أسواق تجارية','طرق رئيسية','حدائق'];
  var INS_AMENITIES_ON=['مساجد','أسواق تجارية','طرق رئيسية'];
  var INS_PHOTOS=[['الواجهة الأمامية',1,1],['الجهات الأخرى',1,1],['عداد المياه',1,1],['عداد الكهرباء',1,1],['من الداخل',1,1],['الأرضيات',0,1]];
  var INS_OBS=[['عيب ظاهر','تشقق شعري في جدار السور الجنوبي بطول ~1.2 م.'],['ميزة','تشطيب داخلي حديث للمطبخ ودورات المياه.'],['المحيط والجوار','قرب من مسجد الحي وسوق تجاري (~200 م).'],['الحدود','عدم تطابق الطول الشرقي مع الصك — موثّق بالصورة.']];
  function insBadge(t,c){ var m={info:['#1f6f6f','#2a8f8f'],danger:['#b23b3b','#d9694f'],purple:['#6b46c1','#8b5cf6'],def:['var(--text-2)','var(--border-2)']}; var x=m[c]||m.def; return '<span style="flex:none;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;color:'+x[0]+';background:color-mix(in srgb,'+x[1]+' 14%,transparent);border:1px solid color-mix(in srgb,'+x[1]+' 30%,transparent)">'+t+'</span>'; }
  function insCard(title,badge,body){ return '<div class="card" style="padding:14px 16px;box-shadow:none;border:1px solid var(--border);margin-bottom:12px">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:13px;font-weight:700;color:var(--heading)">'+title+'</span><span style="flex:1"></span>'+(badge||'')+'</div>'+body+'</div>'; }
  function insField(label,value,ed,opts,badge){
    var top='<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="font-size:11px;font-weight:600;color:var(--text-2)">'+label+'</span>'+(badge||'')+'</div>';
    var ctrl;
    if(ed && opts){ ctrl='<select style="width:100%;appearance:none;padding:7px 11px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text);font-size:12.5px;font-family:inherit">'+opts.map(function(o){ return '<option'+(o===value?' selected':'')+'>'+o+'</option>'; }).join('')+'</select>'; }
    else if(ed){ ctrl='<input value="'+esc(value)+'" style="width:100%;padding:7px 11px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text);font-size:12.5px;font-family:inherit" />'; }
    else { ctrl='<div style="font-size:13px;font-weight:600;color:var(--heading);padding:2px 0">'+esc(value||'—')+'</div>'; }
    return '<div style="min-width:0">'+top+ctrl+'</div>';
  }
  