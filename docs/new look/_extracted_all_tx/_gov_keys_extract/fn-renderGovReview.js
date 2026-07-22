function renderGovReview(){
    var list=govProps();
    var received=list.filter(function(x){return (x.p._keysStatus||'')==='received';}).length;
    var waiting=list.filter(function(x){return (x.p._keysStatus||'')==='received' && !x.p._env;}).length;
    var done=list.filter(function(x){return x.p._govReviewed;}).length;
    var GCOLS='minmax(125px,1.2fr) minmax(105px,1fr) minmax(120px,1.1fr) 150px 150px 230px';
    var rows=list.map(function(x,i){ var p=x.p,o=x.o;
      var ks=p._keysStatus||'', hasEnv=!!p._env;
      var gate = hasEnv
        ? '<span class="status" style="background:color-mix(in srgb,#2f7a4d 15%,transparent);color:#2f7a4d"><span class="sd" style="background:#2f7a4d"></span>ظرف مسجّل</span>'
        : ks==='received'
          ? '<span class="status" style="background:color-mix(in srgb,#d9a441 18%,transparent);color:#8a5e14"><span class="sd live" style="background:#d9a441"></span>بانتظار الظرف</span>'
          : '<span class="muted">—</span>';
      var act = p._govReviewed
        ? '<span class="status" style="background:color-mix(in srgb,#2f7a4d 15%,transparent);color:#2f7a4d"><span class="sd" style="background:#2f7a4d"></span>منتهية</span>'
        : (hasEnv?'':'<button class="ghost-btn" data-gov-reg="'+i+'" style="height:30px;padding:0 11px;font-size:12px;color:var(--gold-d)">تسجيل ظرف</button>')+
          '<button class="ghost-btn" data-gov-done="'+i+'" style="height:30px;padding:0 11px;font-size:12px;color:#2f7a4d">إنهاء المراجعة</button>';
      return '<div class="row" style="grid-template-columns:'+GCOLS+';min-height:56px">'+
        '<div class="td"><span class="po" data-prop="'+esc(p.id)+'" data-po="'+esc(o.po)+'">'+esc(p.deed)+'</span></div>'+
        '<div class="td muted">'+esc(p.city+' · '+p.district)+'</div>'+
        '<div class="td" style="flex-direction:column;align-items:flex-start;gap:2px"><span style="font-size:12.5px;font-weight:600;color:var(--heading)">'+esc(p.court)+'</span><span style="font-size:11px;color:var(--text-3)">طلب '+esc(p.request)+' · '+esc(p.circuit)+'</span></div>'+
        '<div class="td"><div class="sel" style="width:100%"><select data-gov-ks="'+i+'" style="width:100%;padding:7px 30px 7px 10px;font-size:12.5px"><option value=""'+(ks===''?' selected':'')+'>— اختر —</option><option value="received"'+(ks==='received'?' selected':'')+'>مستلمة</option><option value="pending"'+(ks==='pending'?' selected':'')+'>قيد الاستلام</option><option value="not_required"'+(ks==='not_required'?' selected':'')+'>لا تتطلب مفاتيح</option></select><span class="caret"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></div></div>'+
        '<div class="td">'+gate+'</div>'+
        '<div class="td c" style="gap:6px">'+act+'</div>'+
      '</div>';
    }).join('');
    var html=
      '<div class="kpi">'+
        '<div class="first"><div class="kpi-head"><span class="kpi-ico gold"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M6 21V7l6-4 6 4M12 3v18"/></svg></span><span>عقارات في طابور المراجعة</span></div><div class="kpi-num">'+list.length+'</div><div class="kpi-sub"><span class="g"></span>صكوك مسجّلة</div></div>'+
        '<div><div class="kpi-head"><span class="kpi-ico" style="background:color-mix(in srgb,#2f7a4d 16%,transparent);color:#2f7a4d"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m11.5 11.5 9.5-9.5M15.5 7.5l3 3"/></svg></span><span>مفاتيح مستلمة</span></div><div class="kpi-num">'+received+'</div><div class="kpi-sub">من اختيار المراجع</div></div>'+
        '<div><div class="kpi-head"><span class="kpi-ico" style="background:color-mix(in srgb,#d9a441 20%,transparent);color:#8a5e14"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg></span><span>بانتظار الظرف</span></div><div class="kpi-num">'+waiting+'</div><div class="kpi-sub">مستلمة دون ظرف مسجّل</div></div>'+
        '<div><div class="kpi-head"><span class="kpi-ico" style="background:color-mix(in srgb,#3f8f5f 16%,transparent);color:#2f7a4d"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg></span><span>مراجعات منتهية</span></div><div class="kpi-num">'+done+'</div><div class="kpi-sub">من '+list.length+' إجمالي</div></div>'+
      '</div>'+
      '<div class="toolbar">'+
        '<div style="display:flex;align-items:center;gap:10px"><h2>طابور المراجعة الحكومية</h2><span class="chip">'+list.length+' عقار</span><span style="display:inline-flex;align-items:center;gap:6px;padding:3px 11px;border-radius:6px;background:var(--gold-soft);color:var(--gold-d);font-size:12px;font-weight:700"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>مشعل — مراجع حكومي</span></div>'+
        '<div class="filters"><button class="ghost-btn" data-nav-keys="1"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m11.5 11.5 9.5-9.5M15.5 7.5l3 3"/></svg><span>محفظة المفاتيح</span></button><button class="primary" id="govRegBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg><span>تسجيل ظرف مفاتيح</span></button></div>'+
      '</div>'+
      '<div class="card"><div class="scroll"><div class="grid" style="min-width:1020px">'+
        '<div class="thead" style="grid-template-columns:'+GCOLS+'"><div class="th" style="justify-content:flex-start">رقم الصك</div><div class="th" style="justify-content:flex-start">الموقع</div><div class="th" style="justify-content:flex-start">المحكمة / الطلب</div><div class="th" style="justify-content:flex-start">حالة المفاتيح</div><div class="th" style="justify-content:flex-start">بوابة الظرف</div><div class="th">إجراء</div></div>'+
        (list.length?rows:'<div class="empty"><div class="t">لا توجد عقارات مسجّلة بعد</div></div>')+
      '</div></div></div>'+
      '<p style="font-size:11.5px;color:var(--text-3);padding:12px 4px 0">الإنهاء لا يُمنع عند غياب الظرف — تبقى شارة «بانتظار الظرف» وتتم مزامنة ناعمة مع الظرف إن وُجد.</p>';
    var v=document.getElementById('view-govReview'); v.innerHTML=html;
    v.querySelectorAll('[data-gov-ks]').forEach(function(s){ s.addEventListener('change',function(){ var x=govProps()[+s.getAttribute('data-gov-ks')]; if(x){ x.p._keysStatus=s.value; renderGovReview(); } }); });
    var gb=document.getElementById('govRegBtn'); if(gb) gb.addEventListener('click',function(){ openKeyRegister(); });
    setHeader('المراجعة الحكومية', crumb(['دراسة الحالة','المعاملات النشطة','المراجعة الحكومية']));
    navActive('المراجعة الحكومية');
    showView('govReview');
  }