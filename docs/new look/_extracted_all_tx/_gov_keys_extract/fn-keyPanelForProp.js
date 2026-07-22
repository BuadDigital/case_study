function keyPanelForProp(p,o){
    if(p.awaiting) return '<div class="panel-note">لا يوجد ظرف مفاتيح مرتبط بهذا العقار بعد — يظهر هنا مسار المفتاح فور تسجيل الظرف برقم الطلب.</div>';
    var env=ensurePropEnv(p,o), a=env.assignments[0], km=keyAssign(a.status), stt=keyStat(env.status);
    var mate=(env.handoffs[0]||{}).person||'مشعل';
    var holder=env.status==='assessor'?mate:'مشعل';
    var holderRole=env.status==='assessor'?'معاين ميداني':'مراجع حكومي';
    var journeyItems=[
      {c:'#2f7a4d',title:'استلام وتسجيل الظرف',date:env.created,detail:'سُجّل الظرف برقم الطلب '+env.request+' بعد استلامه من '+env.court+'.',person:'مشعل',role:'مراجع حكومي'},
      {c:'#8c7857',title:'إسناد المفتاح للصك',date:env.created,detail:'رُبط المفتاح مبدئياً بالصك '+a.deed+' (استرشادي حتى التجربة الميدانية).'}
    ];
    if(env.status==='assessor') journeyItems.push({c:'#2f7a4d',title:'مناولة داخلية للمعاين',date:env.created,detail:'سُلّم الظرف داخلياً وأُكّد استلامه ميدانياً.',person:mate,role:'معاين ميداني'});
    if(a.status==='matched') journeyItems.push({c:'#2f7a4d',title:'تجربة ميدانية: مطابق',date:env.created,detail:'فُتح الباب بنجاح — تأكّد ارتباط المفتاح بالصك.',person:mate,role:'معاين ميداني'});
    else if(a.status==='unmatched') journeyItems.push({c:'#d9694f',title:'تجربة ميدانية: غير مطابق',date:env.created,detail:'المفتاح لا يطابق القفل — يلزم تواصل أو مسار بديل.',person:mate,role:'معاين ميداني'});
    var card=function(k,v,sub){ return '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:14px 16px"><div style="font-size:11.5px;color:var(--text-3);margin-bottom:6px">'+esc(k)+'</div><div style="font-size:14.5px;font-weight:800;color:var(--heading)">'+v+'</div>'+(sub?'<div style="font-size:11.5px;color:var(--text-3);margin-top:3px">'+esc(sub)+'</div>':'')+'</div>'; };
    var court=p._court||'none';
    var gm = court==='enabled_no_key'?['تمكين بدون مفتاح','#378add','مسار المحكمة']:['مستلمة','#2f7a4d','ظرف مسجّل'];
    var suspend = court==='suspended_eviction';
    var seg=function(v,l){ return '<button class="tf-seg'+(court===v?' active':'')+'" data-pca="'+v+'" data-po="'+esc(o.po)+'" data-prop="'+esc(p.id)+'">'+l+'</button>'; };
    var COURTCARD = '<div class="card" style="padding:18px 22px;margin-bottom:18px">'+
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:'+(suspend?'12px':'14px')+'"><span style="font-size:13px;font-weight:800;color:var(--heading)">بوابة حالة المفاتيح</span>'+keyPill(gm[1],gm[0])+'<span style="font-size:11.5px;color:var(--text-3)">المصدر: '+gm[2]+'</span></div>'+
      (suspend?'<div style="display:flex;align-items:center;gap:9px;margin-bottom:14px;padding:10px 13px;border-radius:10px;background:color-mix(in srgb,#d9694f 9%,transparent);color:#a32d2d;font-size:12.5px;font-weight:600"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>الدراسة معلّقة حتى تنفيذ الإخلاء (محظر إخلاء).</div>':'')+
      '<div style="font-size:11.5px;color:var(--text-3);margin-bottom:8px">مسار المحكمة المستقل (تمكين / محظر إخلاء) — منفصل تماماً عن عهدة الظرف</div>'+
      '<div class="tf-seg-row">'+seg('none','لا يوجد')+seg('enabled_no_key','تمكين بدون مفتاح')+seg('suspended_eviction','محظر إخلاء')+'</div>'+
    '</div>';
    return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-bottom:18px">'+
        card('الظرف التابع له','<a class="po" data-open-key="'+esc(env.id)+'" style="cursor:pointer">'+esc(env.request)+'</a>',env.court)+
        card('العهدة الحالية',esc(holder),holderRole)+
        card('نتيجة التجربة الميدانية','<span style="color:'+km[1]+'">'+esc(km[0])+'</span>',a.status==='matched'?'تأكّد ميدانياً':a.status==='unmatched'?'يلزم مسار بديل':'بانتظار التجربة')+
      '</div>'+
      COURTCARD+
      '<div class="card" style="padding:22px 24px"><h3 style="font-size:14px;font-weight:800;color:var(--heading);margin:0 0 18px;display:flex;align-items:center;gap:9px"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--gold-d)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>التسلسل الزمني للمفتاح</h3>'+keyTimeline(journeyItems)+'</div>';
  }
