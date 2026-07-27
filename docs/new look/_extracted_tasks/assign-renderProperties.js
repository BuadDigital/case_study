function renderProperties(poId){
    var o = ORDERS.find(function(x){ return x.po === poId; }); if (!o) return;
    var props = genProps(o);
    var tone = typeTone[o.type] || '#8a8d96';
    var sc = STATUS[o.status] || STATUS['قيد الدراسة'];
    var PPCOLS = 'minmax(120px,1.3fr) minmax(90px,1fr) minmax(110px,1.1fr) minmax(84px,.8fr) minmax(92px,.9fr) 44px';
    var rows = props.map(function(p){
      var ps = PSTATUS[p.status];
      var dsc = p.deedStatus === 'فعال' ? '#3f8f5f' : '#8a8d96';
      var deedStatusCell = p.awaiting
        ? '<div class="td muted">—</div>'
        : '<div class="td"><span class="status" style="background:color-mix(in srgb,' + dsc + ' 15%,transparent);color:' + dsc + '"><span class="sd" style="background:' + dsc + '"></span>' + esc(p.deedStatus) + '</span></div>';
      return '<div class="row" data-prop="' + esc(p.id) + '" data-po="' + esc(poId) + '" style="cursor:pointer;grid-template-columns:' + PPCOLS + '">' +
        '<div class="td"><span style="display:inline-flex;align-items:center;gap:8px"><span class="ppt-num">' + p.idx + '</span><span class="ppt-deed">' + esc(p.deed) + '</span></span></div>' +
        '<div class="td muted">' + (p.awaiting ? 'بانتظار البورصة' : esc(p.city + ' · ' + p.district)) + '</div>' +
        '<div class="td">' + (p.awaiting ? '—' : esc(p.cls + ' · ' + p.ptype)) + '</div>' +
        deedStatusCell +
        '<div class="td"><span class="status" style="background:color-mix(in srgb,' + ps.c + ' 15%,transparent);color:' + ps.c + '"><span class="sd" style="background:' + ps.c + '"></span>' + ps.t + '</span></div>' +
        '<div class="td"><div class="actions"><button class="kebab" aria-label="إجراءات العقار"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button><div class="act-pop">' +
          (p.status !== 'done' ? '<div class="act-row" data-prop="' + esc(p.id) + '" data-po="' + esc(poId) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18l7-5 7 5V3z" opacity="0"/><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg><span>' + esc(PACTION[p.status] || 'متابعة الإجراء') + '</span></div>' +
            '<div class="act-sep"></div>' : '') +
          '<div class="act-row" data-prop="' + esc(p.id) + '" data-po="' + esc(poId) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span>تفاصيل العقار</span></div>' +
          '<div class="act-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span>تعديل العقار</span></div>' +
          (p.status === 'done' ? '<div class="act-sep"></div>' +
            '<div class="act-row" data-reopen="' + esc(p.id) + '" data-po="' + esc(poId) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg><span>فتح المعاملة</span><span style="margin-inline-start:auto;background:color-mix(in srgb,#d9694f 15%,transparent);color:#c0553d;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px">صلاحية عالية</span></div>' : '') +
          '<div class="act-sep"></div>' +
          '<div class="act-row danger"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg><span>رفع تعذّر</span></div>' +
        '</div></div></div>' +
        '</div>';
    }).join('');
    var html =
      '<button class="back-link" data-nav-po="1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg><span>أوامر العمل</span></button>' +
      '<div class="pp-head">' +
        '<h1 class="pp-title"><span>عقارات</span><span class="pp-po">' + esc(o.po) + '</span></h1>' +
        '<div class="pp-meta"><span class="pp-badge" style="background:color-mix(in srgb,' + tone + ' 15%,transparent);color:' + tone + '">' + esc(o.type) + '</span><span style="color:var(--text-3)">·</span><span>' + o.count + ' من ' + o.count + ' عقارات</span></div>' +
        '<div class="pp-summary">' +
          '<div class="pp-cell"><div class="k">أخصائي الإسناد</div><div class="v">' + esc(o.specialist || '—') + '</div></div>' +
          '<div class="pp-cell"><div class="k">استلام إنفاذ</div><div class="v ltr">' + esc(o.received) + '</div></div>' +
          '<div class="pp-cell"><div class="k">تاريخ الاستحقاق</div><div class="v ltr"' + (isUrgent(o) ? ' style="color:#d9694f"' : '') + '>' + esc(o.due) + '</div></div>' +
          '<div class="pp-cell"><div class="k">المتبقي للتسليم</div><div class="v" id="ppCountdown"' + (isUrgent(o) ? ' style="color:#d9694f"' : '') + '>' + remainCountdown(o) + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="card"><div class="scroll"><div class="grid" style="min-width:100%">' +
        '<div class="thead" style="grid-template-columns:minmax(120px,1.3fr) minmax(90px,1fr) minmax(110px,1.1fr) minmax(84px,.8fr) minmax(92px,.9fr) 44px">' +
          '<div class="th">رقم الصك</div><div class="th">الموقع</div><div class="th">التصنيف / النوع</div><div class="th">حالة الصك</div><div class="th">الحالة</div><div class="th c"></div>' +
        '</div>' +
        '<div id="ppRows">' + rows + '</div>' +
      '</div></div></div>' +
      '<p style="font-size:11.5px;color:var(--text-3);padding:12px 4px 0">اضغط الصف لمعاينة تفاصيل العقار.</p>';
    var v = document.getElementById('view-properties');
    v.innerHTML = html;
    if (ppTimer) { clearInterval(ppTimer); ppTimer = null; }
    if (!TERMINAL[o.status]) {
      ppTimer = setInterval(function(){
        var el = document.getElementById('ppCountdown');
        if (!el || document.getElementById('view-properties').hidden) { clearInterval(ppTimer); ppTimer = null; return; }
        el.innerHTML = remainCountdown(o);
      }, 1000);
    }
    setHeader('عقارات ' + o.po, crumb(['لوحة التحكم','دراسة الحالة','أوامر العمل','عقارات']));
    navActive('أوامر العمل (PO)');
    showView('properties');
  }