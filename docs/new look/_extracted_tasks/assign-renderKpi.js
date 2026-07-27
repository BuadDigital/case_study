function renderKpi(){
    var stats=[['86%','معدل الإنجاز في الموعد','هدف: 90%'],['3.6 يوم','متوسط إنجاز العقار','هدف: أقل من 4'],['4%','معدل التعذرات','هدف: أقل من 5%'],['12','عقارات مُنجزة اليوم','هدف: 40–50']];
    var spec=[['أسامة الصالحي',92],['عبدالله الكثيري',88],['عمر',81],['عثمان',76]];
    var prov=[['مكتب جدة للمساحة',90],['مكتب مكة الهندسي',84],['فراس كمرين — مراجع حكومي',79],['عبدالله عبدالمانع — معاين',72]];
    function bars(rows){ return rows.map(function(r){ var v=r[1], c=v>=85?GREEN:(v>=70?GOLD:RED); return '<div class="bar-row"><span class="lbl">'+esc(r[0])+'</span><span class="bar"><span style="width:'+v+'%;background:'+c+'"></span></span><span class="n">'+v+'%</span></div>'; }).join(''); }
    document.getElementById('view-generic').innerHTML =
      '<div class="kpi">'+stats.map(statCard).join('')+'</div>'+
      '<div class="dash-grid"><div class="dash-card"><h3>أداء أخصائيي دراسة الحالة</h3>'+bars(spec)+'</div><div class="dash-card"><h3>أداء مزودي الخدمة</h3>'+bars(prov)+'</div></div>';
    setHeader('مؤشرات الأداء', crumb(['لوحة التحكم','مؤشرات الأداء']));
    navActive('مؤشرات الأداء'); showView('generic');
  }