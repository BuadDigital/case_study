function renderFinancial(){
    var rev = [
      ['PO-2026-0010','10','0','٤٨٬٠٠٠','INV-2211',pill('مُفوتَر',GREEN)],
      ['PO-2026-0011','6','4','٢٩٬٥٠٠','INV-2208',pill('جزئي',AMBER)],
      ['PO-004','5','0','٢٢٬٠٠٠','INV-2199',pill('مُفوتَر',GREEN)]
    ];
    var cost = [
      ['مكتب جدة للمساحة',pill('خارجي',GRAY),'٨٬٥٠٠','رفع مساحي'],
      ['عبدالله عبدالمانع',pill('متعاون',AMBER),'٣٬٢٠٠','معاينة ميدانية'],
      ['فراس كمرين',pill('داخلي',NAVY),'٤٬٠٠٠','مراجعة حكومية']
    ];
    document.getElementById('view-generic').innerHTML =
      '<div style="display:grid;gap:18px">' +
        '<div><h3 style="font-size:14px;font-weight:700;color:var(--heading);margin:0 0 12px">إيرادات إنفاذ</h3>' + miniTable(['PO','مُفوتَرة','مستثنيات','القيمة','الفاتورة','الحالة'], rev) + '</div>' +
        '<div><h3 style="font-size:14px;font-weight:700;color:var(--heading);margin:0 0 12px">تكاليف مزودي الخدمة</h3>' + miniTable(['المزود','النوع','التكلفة','الفئة'], cost) + '</div>' +
      '</div>';
    setHeader('التقارير المالية', crumb(['لوحة التحكم','التقارير المالية']));
    navActive('التقارير المالية'); showView('generic');
  }