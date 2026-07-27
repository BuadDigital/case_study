function renderProperty(poId, propId){
    var o = ORDERS.find(function(x){ return x.po === poId; }); if (!o) return;
    var props = genProps(o), p = props.find(function(x){ return x.id === propId; }); if (!p) return;
    var tabs = ['نظرة عامة','دراسة الحالة','التقييم','المالية','المفاتيح','الصور'];
    var locTxt = p.awaiting ? '' : (p.city + ' · ' + p.district);
    var typeTxt = p.awaiting ? '' : (p.cls + ' · ' + p.ptype);
    var courtTxt = p.awaiting ? '' : (p.court + ' · ' + p.circuit);
    var areaTxt = p.awaiting ? '' : (p.area + ' م²');
    var overview = '<div class="fields">' +
      field('اسم المالك', p.owner) +
      field('المدينة / الحي', p.awaiting ? 'بانتظار البورصة' : locTxt) +
      field('التصنيف', p.cls) +
      field('النوع', p.ptype) +
      field('المساحة', areaTxt) +
      field('حالة الصك', p.deedStatus) +
      field('المحكمة', p.court) +
      field('الدائرة', p.circuit) +
      field('رقم الطلب', p.request, true) +
      field('تاريخ الاستحقاق', o.due, true) +
    '</div>';
    var ps = PSTATUS[p.status];
    var html =
      '<button class="back-link" data-back-props="' + esc(poId) + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg><span>عقارات ' + esc(o.po) + '</span></button>' +
      '<div class="pd-hero">' +
        '<div class="pd-eyebrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg><span>عقار ' + p.idx + ' من ' + o.count + ' في ' + esc(o.po) + '</span></div>' +
        '<h1 class="pd-title"><span>صك رقم <bdi style="direction:ltr">' + esc(p.deed) + '</bdi></span>' +
          '<span class="pp-badge" style="background:color-mix(in srgb,' + ps.c + ' 15%,transparent);color:' + ps.c + '">' + ps.t + '</span>' +
          '<span class="pd-req"><span class="k">رقم الطلب</span><span class="v">' + esc(p.request || '—') + '</span></span></h1>' +
        '<div class="pd-strip">' +
          '<div class="pp-cell"><div class="k">المالك</div><div class="v">' + esc(p.owner || '—') + '</div></div>' +
          '<div class="pp-cell"><div class="k">المدينة / الحي</div><div class="v">' + esc(locTxt || 'بانتظار البورصة') + '</div></div>' +
          '<div class="pp-cell"><div class="k">التصنيف</div><div class="v">' + esc(typeTxt || '—') + '</div></div>' +
          '<div class="pp-cell"><div class="k">المساحة</div><div class="v">' + esc(areaTxt || '—') + '</div></div>' +
          '<div class="pp-cell"><div class="k">المحكمة / الدائرة</div><div class="v">' + esc(courtTxt || '—') + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="tabs">' + tabs.map(function(t,i){ return '<button class="tab' + (i === 0 ? ' on' : '') + '" data-tab="' + i + '">' + esc(t) + '</button>'; }).join('') + '</div>' +
      '<div id="pdPanel">' + overview + '</div>';
    var v = document.getElementById('view-property');
    v.innerHTML = html;
    var panels = [overview,
      '<div class="panel-note">نموذج دراسة الحالة — تُجمَّع بيانات الأطراف (المعاين، المقيم، المكتب الهندسي، المراجع الحكومي) ويعتمدها أخصائي دراسة الحالة.</div>',
      '<div class="panel-note">بيانات التقييم العقاري للعقار.</div>',
      '<div class="panel-note">الأتعاب والمصروفات المرتبطة بالعقار.</div>',
      keyPanelForProp(p, o),
      '<div class="panel-note">صور المعاينة الميدانية المختومة.</div>'];
    v.querySelectorAll('.tab').forEach(function(tb){
      tb.addEventListener('click', function(){
        v.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('on'); });
        tb.classList.add('on');
        document.getElementById('pdPanel').innerHTML = panels[+tb.getAttribute('data-tab')];
      });
    });
    setHeader('تفاصيل العقار', crumb(['أوامر العمل','عقارات ' + o.po,'العقار']));
    navActive('أوامر العمل (PO)');
    showView('property');
  }