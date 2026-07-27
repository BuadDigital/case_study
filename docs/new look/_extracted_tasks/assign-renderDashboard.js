function renderDashboard(){
    var counts = {};
    ORDERS.forEach(function(o){ counts[o.status] = (counts[o.status] || 0) + 1; });
    var order = ['جديد','قيد الدراسة','مفوتر جزئي','مكتمل','مفوتر بالكامل','متوقف','ملغي'];
    var statusBars = order.filter(function(s){ return counts[s]; }).map(function(s){
      var sc = STATUS[s], n = counts[s], pct = Math.round(n / ORDERS.length * 100);
      return '<div class="bar-row"><span class="lbl">' + esc(s) + '</span><span class="bar"><span style="width:' + pct + '%;background:' + sc.base + '"></span></span><span class="n">' + n + '</span></div>';
    }).join('');
    var bySpec = {};
    ORDERS.forEach(function(o){ var s = o.specialist || 'غير مُسند'; bySpec[s] = (bySpec[s] || 0) + 1; });
    var maxSpec = Math.max.apply(null, Object.keys(bySpec).map(function(k){ return bySpec[k]; }));
    var specBars = Object.keys(bySpec).sort(function(a,b){ return bySpec[b] - bySpec[a]; }).map(function(s){
      var n = bySpec[s], pct = Math.round(n / maxSpec * 100);
      return '<div class="bar-row"><span class="lbl">' + esc(s) + '</span><span class="bar"><span style="width:' + pct + '%;background:var(--gold)"></span></span><span class="n">' + n + '</span></div>';
    }).join('');
    var propCount = ORDERS.reduce(function(n,o){ return n + o.count; }, 0);
    var stat = function(v,l){ return '<div class="dash-card" style="padding:16px 18px"><div style="font-size:30px;font-weight:800;color:var(--heading);line-height:1">' + v + '</div><div style="font-size:12.5px;color:var(--text-2);margin-top:6px">' + l + '</div></div>'; };
    document.getElementById('view-dashboard').innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px">' +
        stat(ORDERS.length,'إجمالي أوامر العمل') + stat(propCount,'إجمالي العقارات') +
        stat((propCount / ORDERS.length).toFixed(1),'متوسط العقارات / أمر') +
        stat((counts['مكتمل'] || 0) + (counts['مفوتر بالكامل'] || 0),'مكتملة') +
      '</div>' +
      '<div class="dash-grid">' +
        '<div class="dash-card"><h3>توزيع الحالات</h3>' + statusBars + '</div>' +
        '<div class="dash-card"><h3>الحمل حسب الأخصائي</h3>' + specBars + '</div>' +
      '</div>';
    setHeader('لوحة التحكم', crumb(['الرئيسية','لوحة التحكم']));
    navActive('لوحة التحكم');
    showView('dashboard');
  }