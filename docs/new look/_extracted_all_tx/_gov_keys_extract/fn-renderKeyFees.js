function renderKeyFees(){
    var fees=KEY_ENV.filter(function(e){ return e.fee; });
    var open=fees.filter(function(e){ return (e.feeState||'open')!=='collected'; });
    var totalOpen=open.reduce(function(n,e){ return n+(e.feeAmount||0); },0);
    var totalAll=fees.reduce(function(n,e){ return n+(e.feeAmount||0); },0);
    var FCOLS='minmax(120px,1.1fr) minmax(150px,1.4fr) 110px 130px 150px';
    var rows=fees.map(function(e){ var collected=(e.feeState||'open')==='collected'; var c=collected?'#2f7a4d':'#d9a441';
      return '<div class="row" style="grid-template-columns:'+FCOLS+';min-height:54px"><div class="td"><span class="po" data-key-open="'+esc(e.id)+'">'+esc(e.request)+'</span></div><div class="td muted">'+esc(e.court)+'</div><div class="td num">'+e.feeAmount+' ر.س</div><div class="td"><span class="status" style="background:color-mix(in srgb,'+c+' 15%,transparent);color:'+c+'"><span class="sd" style="background:'+c+'"></span>'+(collected?'محصّلة':'بانتظار التحصيل')+'</span></div><div class="td c">'+(collected?'<span style="font-size:11.5px;color:var(--text-3)">أكّدته المالية</span>':'<button class="ghost-btn" data-fee-collect="'+esc(e.id)+'" style="height:30px;padding:0 12px;font-size:12px;color:#2f7a4d">تأكيد التحصيل (المالية)</button>')+'</div></div>';
    }).join('');
    var html=
      '<button class="back-link" data-nav-keys="1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg><span>محفظة المفاتيح</span></button>'+
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px">'+
        '<div class="dash-card" style="padding:16px 18px"><div style="font-size:30px;font-weight:800;color:var(--heading);line-height:1">'+fees.length+'</div><div style="font-size:12.5px;color:var(--text-2);margin-top:6px">بنود أتعاب (سيناريو المحكمة)</div></div>'+
        '<div class="dash-card" style="padding:16px 18px"><div style="font-size:30px;font-weight:800;color:#8a5e14;line-height:1">'+totalOpen+' <span style="font-size:15px">ر.س</span></div><div style="font-size:12.5px;color:var(--text-2);margin-top:6px">مفتوح للتحصيل ('+open.length+')</div></div>'+
        '<div class="dash-card" style="padding:16px 18px"><div style="font-size:30px;font-weight:800;color:#2f7a4d;line-height:1">'+totalAll+' <span style="font-size:15px">ر.س</span></div><div style="font-size:12.5px;color:var(--text-2);margin-top:6px">إجمالي الأتعاب المولّدة</div></div>'+
      '</div>'+
      '<div class="toolbar"><div style="display:flex;align-items:center;gap:10px"><h2>تقرير أتعاب استلام المفاتيح</h2><span class="chip">'+fees.length+' بند</span></div></div>'+
      '<div class="card"><div class="scroll"><div class="grid" style="min-width:720px">'+
        '<div class="thead" style="grid-template-columns:'+FCOLS+'"><div class="th" style="justify-content:flex-start">رقم الطلب</div><div class="th" style="justify-content:flex-start">المحكمة</div><div class="th" style="justify-content:flex-start">المبلغ</div><div class="th" style="justify-content:flex-start">الحالة</div><div class="th">إجراء</div></div>'+
        (fees.length?rows:'<div class="empty"><div class="t">لا توجد بنود أتعاب</div><div class="s">تُولَّد الأتعاب تلقائياً لسيناريو استلام المحكمة فقط.</div></div>')+
      '</div></div></div>'+
      '<p style="font-size:11.5px;color:var(--text-3);padding:12px 4px 0">تسجيل الظرف وتصويره يُنشئ حالة مالية بوجوب رفع أتعاب استلام المفتاح — التحصيل يتم بعد اكتمال دراسة الحالة ورفع صورة الظرف على إنفاذ، وتأكيد الاستلام من موظف المالية حصراً.</p>';
    document.getElementById('view-keyFees').innerHTML=html;
    setHeader('تقرير الأتعاب', crumb(['دراسة الحالة','محفظة المفاتيح','تقرير الأتعاب']));
    navActive('إدارة المفاتيح');
    showView('keyFees');
  }
