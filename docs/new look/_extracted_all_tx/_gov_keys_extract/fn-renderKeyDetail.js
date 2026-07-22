function renderKeyDetail(id){
    var e=KEY_ENV.find(function(x){return x.id===id;}); if(!e) return;
    var sc=keyScen(e.scenario), st=keyStat(e.status), mm=e.actual!==e.labeled, fromProp=e.id.indexOf('ENVP-')===0;
    var alert = mm? '<div style="display:flex;align-items:center;gap:11px;padding:12px 22px;margin-top:14px;border-radius:10px;background:color-mix(in srgb,#d9694f 9%,transparent);color:#a32d2d;font-size:12.5px;font-weight:600;line-height:1.6"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg><span>تعارض في العدد: المكتوب على الظرف '+e.labeled+' والفعلي بعد العد '+e.actual+'. يلزم تعديل خطاب الاستلام في المحكمة.</span></div>' : '';
    var atts = e.attachments.map(function(a){ var m=a.k==='file'?[a.label||'مرفق','#8c7857']:keyAtt(a.k); return '<span class="file-chip" style="color:'+m[1]+'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+ICO_FILE+'</svg>'+esc(m[0])+'</span>'; }).join('');
    if(e.contact) atts += '<span class="file-chip"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'+esc(e.contact)+'</span>';
    var ACOLS='minmax(112px,1fr) minmax(118px,1fr) minmax(105px,.95fr) 128px minmax(85px,.75fr) 218px';
    var assignPanel = e.assignments.length ?
      '<div class="card"><div class="scroll" style="overflow-x:auto"><div class="grid" style="min-width:780px"><div class="thead" style="grid-template-columns:'+ACOLS+';border-bottom:2px solid var(--gold)"><div class="th" style="justify-content:flex-start">رقم الصك</div><div class="th" style="justify-content:flex-start">العقار</div><div class="th" style="justify-content:flex-start">أمر العمل</div><div class="th" style="justify-content:flex-start">حالة التجربة</div><div class="th" style="justify-content:flex-start">ملاحظة</div><div class="th">تأكيد ميداني</div></div>'+
        e.assignments.map(function(a,i){ return {a:a,i:i}; }).sort(function(x,y){ return (x.a.status==='pending'?0:1)-(y.a.status==='pending'?0:1); }).map(function(w){ var a=w.a, i=w.i, m=keyAssign(a.status);
          var act = a.status==='pending'
            ? '<div class="td c"><button class="ghost-btn" data-kres="1" data-ke="'+esc(e.id)+'" data-kai="'+i+'" style="height:30px;padding:0 14px;font-size:12px;white-space:nowrap;color:var(--gold-d)">تسجيل نتيجة المطابقة…</button></div>'
            : '<div class="td c"><span style="font-size:11.5px;color:var(--text-3)">'+(a.confirmedBy?'أكّده '+esc(a.confirmedBy):'مؤكّد')+'</span></div>';
          var prior=priorWork(a.deed, a.po||'');
          var pDone=prior.length&&prior.some(function(w){return w.done;});
          var pc=pDone?['#2f7a4d','مُنجز سابقاً · ']:['#8a5e14','سبق العمل عليه · '];
          var poCell='<div class="td" style="flex-direction:column;align-items:flex-start;gap:3px;justify-content:center"><span style="font-size:12px;font-weight:600;color:var(--text-2)">'+esc(a.po||'—')+'</span>'+(prior.length?'<span title="سبق العمل على هذا الصك في: '+esc(prior.map(function(w){return w.po;}).join('، '))+'" style="display:inline-flex;align-items:center;gap:4px;padding:1px 8px;border-radius:99px;font-size:10.5px;font-weight:700;background:color-mix(in srgb,'+pc[0]+' 16%,transparent);color:'+pc[0]+';cursor:default">'+pc[1]+esc(prior[0].po)+'</span>':'')+'</div>';
          return '<div class="row" style="grid-template-columns:'+ACOLS+';min-height:52px"><div class="td"><span class="po" data-kfile="'+esc(e.id)+'" data-kfi="'+i+'" title="فتح ملف المفتاح">'+esc(a.deed)+'</span></div><div class="td muted">'+esc(a.property)+'</div>'+poCell+'<div class="td">'+keyPill(m[1],m[0])+'</div><div class="td muted">'+esc(a.note)+'</div>'+act+'</div>'; }).join('')+
      '</div></div></div>' :
      '<div class="panel-note">لا توجد إسنادات صكوك لهذا الظرف بعد.</div>';
    var chain=[{type:'receive_back', _initial:true, state:'completed', person:(e.receivedBy||'أحمد الشمري'), role:'مراجع حكومي', date:e.created, letter:'', from:(e.scenario==='party'?('طرف آخر'+(e.sourceParty?': '+e.sourceParty:'')):e.court)}].concat(e.handoffs);
    var handoffPanel =
      '<div class="card" style="padding:6px 22px">'+chain.map(function(h,i){ var m=h._initial?['استلام الظرف — بداية العهدة'+(h.from?' (من '+h.from+')':''),'#378add']:keyHoType(h.type), s=keyHoState(h.state); return '<div style="display:flex;gap:15px;padding:16px 0;'+(i?'border-top:1px solid var(--border);':'')+'align-items:flex-start"><span style="width:40px;height:40px;border-radius:10px;display:grid;place-items:center;flex-shrink:0;background:color-mix(in srgb,'+m[1]+' 14%,transparent);color:'+m[1]+'"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M21 3l-8 8M8 21H3v-5M3 21l8-8"/></svg></span><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:14px;font-weight:700;color:var(--heading)">'+esc(m[0])+'</span><span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:color-mix(in srgb,'+s[1]+' 15%,transparent);color:'+s[1]+'">'+esc(s[0])+'</span></div><div style="font-size:13px;color:var(--text-2);margin-top:5px">'+esc(h.person)+' — '+esc(h.role)+'</div>'+(h.type==='internal'&&h.state==='pending_confirm'?'<div style="margin-top:10px"><button class="remind-btn" data-khc="1" data-ke="'+esc(e.id)+'" data-khi="'+(i-1)+'" style="height:32px;padding:0 14px;font-size:12px">تأكيد استلام المعاين</button></div>':'')+(h.letter?'<div style="display:inline-flex;align-items:center;gap:6px;margin-top:9px;font-size:12px;color:var(--gold-d);font-weight:600"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+ICO_FILE+'</svg>'+esc(h.letter)+'</div>':'')+'</div><div style="font-size:12px;color:var(--text-3);white-space:nowrap;direction:ltr">'+esc(h.date)+'</div></div>'; }).join('')+'</div>';
    var timelinePanel='';
    var custodyPanel='<div style="font-size:13px;font-weight:800;color:var(--heading);margin:2px 2px 12px">سلسلة العهدة (من استلم ومن سلّم)</div>'+handoffPanel;
    var tabs=['إسناد الصكوك','سلسلة العهدة'];
    var counts=[e.assignments.length,e.handoffs.length+1];
    var backLabel = fromProp? 'تفاصيل العقار' : 'محفظة المفاتيح';
    var html=
      '<button class="back-link" data-key-back="'+(fromProp?'prop':'list')+'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg><span>'+esc(backLabel)+'</span></button>'+
      '<div class="pp-head">'+
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap">'+
          '<div style="display:flex;align-items:center;gap:15px;min-width:0">'+
            '<span style="width:50px;height:50px;border-radius:13px;display:grid;place-items:center;background:var(--gold-soft);color:var(--gold-d);flex-shrink:0"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+ICO_ENV+'</svg></span>'+
            '<div style="min-width:0"><h1 class="pp-title"><span class="pp-po" style="font-size:19px">'+esc(keyRef(e))+'</span><span style="font-size:13px;color:var(--text-3);font-weight:600">طلب '+esc(e.request)+'</span>'+keyPill(st[1],st[0])+'</h1><div class="pp-meta"><span>'+esc(e.court)+'</span><span style="color:var(--text-3)">·</span><span>'+esc(e.circuit)+'</span></div></div>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">'+
            '<button class="ghost-btn" id="keyHandoffBtn" data-mode="'+(e.status==='reviewer'?'deliver':'receive')+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M21 3l-8 8M8 21H3v-5M3 21l8-8"/></svg><span>'+(e.status==='reviewer'?'تسليم الظرف':e.status==='returned'?'مناولة':'استلام الظرف')+'</span></button>'+
            
          '</div>'+
        '</div>'+
        alert+
        '<div class="pp-summary">'+
          '<div class="pp-cell"><div class="k">سيناريو الاستلام</div><div class="v">'+keyPill(sc[1],sc[0])+'</div></div>'+
          '<div class="pp-cell"><div class="k">مستلم الظرف</div><div class="v">'+esc(e.receivedBy||'أحمد الشمري')+'</div></div>'+
          '<div class="pp-cell"><div class="k">عدد المفاتيح</div><div class="v">'+e.actual+'</div></div>'+
          '<div class="pp-cell"><div class="k">الصكوك المرتبطة بالطلب</div><div class="v">'+e.assignments.length+'</div></div>'+
          '<div class="pp-cell"><div class="k">تاريخ التسجيل</div><div class="v ltr">'+esc(e.created)+'</div></div>'+
        '</div>'+
        (atts?'<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:14px;border-top:1px solid var(--border);padding-top:14px"><span style="font-size:12px;color:var(--text-3);font-weight:600">المرفقات:</span>'+atts+'</div>':'')+
      '</div>'+
      '<div class="tabs">'+tabs.map(function(t,i){ return '<button class="tab'+(i===0?' on':'')+'" data-ktab="'+i+'">'+esc(t)+(counts[i]!=null?' <span style="font-size:11px;background:var(--surface-2);border:1px solid var(--border-2);border-radius:99px;padding:1px 7px;color:var(--text-3);margin-inline-start:5px">'+counts[i]+'</span>':'')+'</button>'; }).join('')+'</div>'+
      '<div id="keyPanel">'+assignPanel+'</div>';
    var v=document.getElementById('view-keyDetail'); v.innerHTML=html;
    var panels=[assignPanel,custodyPanel];
    v.querySelectorAll('.tab').forEach(function(tb){ tb.addEventListener('click',function(){ v.querySelectorAll('.tab').forEach(function(x){x.classList.remove('on');}); tb.classList.add('on'); document.getElementById('keyPanel').innerHTML=panels[+tb.getAttribute('data-ktab')]; }); });
    var hb=document.getElementById('keyHandoffBtn'); if(hb) hb.addEventListener('click',function(){ openKeyHandoff(e); });
    v.setAttribute('data-from', fromProp?'prop':'list');
    setHeader('ملف الظرف', crumb(fromProp?['دراسة الحالة','تفاصيل العقار','ملف الظرف']:['دراسة الحالة','محفظة المفاتيح','ملف الظرف']));
    navActive(fromProp?'أوامر العمل (PO)':'إدارة المفاتيح');
    showView('keyDetail');
  }
