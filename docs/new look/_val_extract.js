/* ═══════════ نافذة المقيم العقاري ═══════════ */
  var VAL_Q_SIMPLE=[
    ['q_plan_match','هل رقم المخطط مطابق للصك؟'],
    ['q_excess_zoning','هل القطعة زائدة تنظيمية؟'],
    ['q_land_waqf','هل الأرض موقوفة؟'],
    ['q_property_waqf','هل العقار موقوف؟'],
    ['q_expropriation','هل يوجد نزع على منطقة العقار؟'],
    ['q_property_use_verified','هل تم التأكد من استخدام العقار؟'],
    ['q_agriculture_inquiry','هل تم الاستعلام من وزارة الزراعة حيال الأرض الزراعية؟'],
    ['q_overlap','هل يوجد تداخل في الأصل؟'],
    ['q_shared_building','هل يوجد على الأصل مبنى مشترك؟'],
    ['q_environmental_factors','هل هناك أي عوامل بيئية أو تنظيمية قد تؤثر على العقار؟ (مثل طريق مستقبلي أو قيود بناء)'],
    ['q_unregistered_additions','هل العقار يحتوي على أي إضافات غير مسجلة في الصك؟']
  ];
  var VAL_Q_COND=[
    ['q_shared_deed','هل الصك مشاع؟'],
    ['q_lease_exists','هل يوجد عقد إيجار؟'],
    ['q_technical_notes_exists','هل يوجد ملاحظات فنية قد تؤثر على قيمة العقار؟']
  ];
  var VAL_TASKS=[
    {id:'AP-101', deed:'88120044991', po:'PO-2026-0005', region:'جدة — الشرفية', kind:'مبنى', assigned:'2026/07/20', reviewDone:true, inspected:true, surveyed:true, status:'active'},
    {id:'AP-102', deed:'10203040506', po:'PO-2026-0011', region:'مكة — العزيزية', kind:'أرض فضاء', assigned:'2026/07/19', reviewDone:true, inspected:true, surveyed:false, status:'active'},
    {id:'AP-103', deed:'55009911223', po:'PO-2026-0013', region:'جدة — المرجان', kind:'أرض فضاء', assigned:'2026/07/22', reviewDone:false, inspected:false, surveyed:false, status:'active'},
    {id:'AP-106', deed:'5022198877', po:'PO-2026-0003', region:'جدة — الفيصلية', kind:'أرض فضاء', assigned:'2026/07/10', reviewDone:true, inspected:true, surveyed:true, demoStatus:'submitted', status:'active'},
    {id:'AP-107', deed:'41556677889', po:'PO-2026-0001', region:'مكة — العوالي', kind:'مبنى', assigned:'2026/06/28', reviewDone:true, inspected:true, surveyed:true, demoStatus:'submitted', closedOnSystem:true, status:'active'},
    {id:'AP-105', deed:'30887712345', po:'PO-2026-0008', region:'جدة — النعيم', kind:'مبنى', assigned:'2026/07/15', reviewDone:true, inspected:true, surveyed:true, demoStatus:'reopened', returnNote:'يرجى مراجعة قيمة المباني — لا تتسق مع المساحة المبنية في تقرير المعاينة.', status:'active'},
    {id:'AP-104', deed:'77341122008', po:'PO-004', region:'جدة — السلامة', kind:'أرض فضاء', assigned:'2026/07/12', reviewDone:true, inspected:true, surveyed:false, needsSurvey:false, status:'active'}
  ];
  var VALS={ task:null, tab:'valuation', err:null, fieldErr:{}, draft:null, draftId:'', showDone:false };
  var VAL_ST_LBL={ draft:['مسودة',GOLD], submitted:['مُرسَل للأخصائي',GREEN], reopened:['مُعاد للتعديل',AMBER], completed:['مكتمل',GREEN] };
  function valNeedsSurvey(t){ return t.needsSurvey!==false; }
  function valDeps(t){
    var a=[{t:'المعاينة الميدانية — المعاين', ok:!!t.inspected, wait:'شرط بدء التقييم'}];
    if(valNeedsSurvey(t)) a.push({t:'الرفع المساحي — المكتب الهندسي', ok:!!t.surveyed, wait:'تأكيد الحدود — قد يعدَّل التقييم بعده'});
    return a;
  }
  function valReadiness(t){
    var sv=!valNeedsSurvey(t)||t.surveyed;
    if(t.inspected&&sv) return 'ready';
    if(t.inspected) return 'wait_survey';
    if(valNeedsSurvey(t)&&t.surveyed) return 'wait_inspection';
    return 'new';
  }
  function valNewDraft(){
    var cl={}; VAL_Q_SIMPLE.concat(VAL_Q_COND).forEach(function(q){ cl[q[0]]=null; });
    cl.shared_deed_scope=null; cl.shared_deed_percentage=''; cl.q_lease_active=null; cl.technical_notes_text='';
    return { status:'draft', price:'', notes:'', report:'', reportNo:'', checklist:cl,
      appraisalDate:'', reportIssueDate:'', method:'طريقة البيوع المقارنة', basis:'القيمة السوقية',
      landValue:'', buildingValue:'', discount:'20', demand:'', searchScope:'', planImage:'', address:'', phone:'' };
  }
  function valLoad(id){ try{ var s=localStorage.getItem('val_draft_'+id); if(s) return JSON.parse(s); }catch(e){} return valNewDraft(); }
  function valSave(){ try{ localStorage.setItem('val_draft_'+VALS.draftId, JSON.stringify(VALS.draft)); }catch(e){} }

  function valTafqit(raw){
    var n=Math.floor(Number(String(raw).replace(/,/g,'')));
    if(!isFinite(n)||n<0) return 'صفر';
    if(n===0) return 'صفر';
    var ones=['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
    var tens=['','عشرة','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
    var hund=['','مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'];
    function u999(x){
      var p=[];
      var hh=Math.floor(x/100), r=x%100;
      if(hh) p.push(hund[hh]);
      if(r){ if(r<20) p.push(ones[r]); else { var o=r%10,t=Math.floor(r/10); p.push(o?ones[o]+' و'+tens[t]:tens[t]); } }
      return p.join(' و');
    }
    function scale(x,forms){ // forms: [مفرد, مثنى, جمع(3-10), تمييز منصوب(11-99), مفرد مضاف(للمئات الصحيحة)]
      if(x===1) return forms[0];
      if(x===2) return forms[1];
      var r=x%100;
      if(r===0) return u999(x)+' '+forms[4];       // مائة ألف، خمسمائة ألف
      if(r===1) return u999(x)+' '+forms[4];       // مائة وواحد ألف → نادر؛ مفرد
      if(r===2) return u999(x-2)+(x-2? ' و':'')+forms[1]; // ...ألفان
      if(r>=3&&r<=10) return u999(x)+' '+forms[2]; // آلاف
      return u999(x)+' '+forms[3];                 // ألفاً
    }
    var parts=[];
    var bi=Math.floor(n/1000000000); n%=1000000000;
    var mi=Math.floor(n/1000000); n%=1000000;
    var th=Math.floor(n/1000); n%=1000;
    if(bi) parts.push(scale(bi,['مليار','ملياران','مليارات','ملياراً','مليار']));
    if(mi) parts.push(scale(mi,['مليون','مليونان','ملايين','مليوناً','مليون']));
    if(th) parts.push(scale(th,['ألف','ألفان','آلاف','ألفاً','ألف']));
    if(n) parts.push(u999(n));
    return parts.join(' و')+' ريال سعودي فقط لا غير';
  }
  function valForced(d){ var t=parseFloat(String(d.price).replace(/,/g,''))||0; var p=parseFloat(String(d.discount).replace(/,/g,''))||0; return Math.max(0, Math.round(t*(1-p/100))); }
  function valPriceFmt(raw){ var n=parseFloat(String(raw).replace(/,/g,'')); if(!isFinite(n)||n<=0) return '—'; return 'SAR '+n.toLocaleString('en-US',{maximumFractionDigits:2}); }
  function valDraftOf(t){ try{ var s=localStorage.getItem('val_draft_'+t.id); if(s) return JSON.parse(s); }catch(e){} return null; }
  function valStatusOf(t){ try{ var s=localStorage.getItem('val_draft_'+t.id); if(s) return (JSON.parse(s).status||'draft'); }catch(e){} return t.demoStatus||'draft'; }
  function renderValOrders(){
    var counts={ready:0, gated:0, submitted:0, reopened:0};
    VAL_TASKS.forEach(function(t){ var st=valStatusOf(t);
      if(st==='submitted') counts.submitted++; else if(st==='reopened') counts.reopened++;
      else if(valReadiness(t)==='ready') counts.ready++; else counts.gated++; });
    var S=function(p){ return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>'; };
    var ico=function(bg,fg,svg){ return '<span class="kpi-ico" style="background:color-mix(in srgb,'+bg+' 14%,transparent);color:'+fg+'">'+svg+'</span>'; };
    document.getElementById('view-generic').innerHTML=
      '<div class="kpi">'+
        '<div class="first"><div class="kpi-head"><span class="kpi-ico gold">'+S('<polygon points="6 4 20 12 6 20 6 4"/>')+'</span><span>جاهزة للتقييم</span></div><div class="kpi-num">'+counts.ready+'</div><div class="kpi-sub"><span class="g"></span>المعاينة مكتملة — باشر التقييم</div></div>'+
        '<div><div class="kpi-head">'+ico('#d9a441','#8a5e14',S('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'))+'<span>بانتظار الأطراف</span></div><div class="kpi-num">'+counts.gated+'</div><div class="kpi-sub">معاينة أو رفع مساحي لم يكتمل</div></div>'+
        '<div><div class="kpi-head">'+ico('#3f8f5f','#2f7a4d',S('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>'))+'<span>مُرسَلة للأخصائي</span></div><div class="kpi-num">'+counts.submitted+'</div><div class="kpi-sub">بانتظار المراجعة والاعتماد</div></div>'+
        '<div><div class="kpi-head">'+ico(NAVY,NAVY,S('<path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 3v6h6"/>'))+'<span>مُعادة للتعديل</span></div><div class="kpi-num">'+counts.reopened+'</div><div class="kpi-sub">أرجعها الأخصائي بملاحظات</div></div>'+
      '</div>'+
      '<div class="toolbar"><div class="filters" style="flex:1">'+
        '<div class="search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input id="valSearch" type="text" placeholder="رقم الصك أو المدينة أو الحي…" /></div>'+
        '<div class="sel"><select id="valStatus"><option value="">جميع الحالات</option><option value="new">جديدة</option><option value="wait_inspection">بانتظار المعاينة</option><option value="wait_survey">بانتظار الرفع المساحي</option><option value="ready">جاهزة للتقييم</option><option value="submitted">مُرسَلة للأخصائي</option><option value="closed">مكتملة على النظام</option><option value="reopened">مُعادة للتعديل</option></select>'+CARET+'</div>'+
        '<button id="valShowDone" type="button" style="display:inline-flex;align-items:center;gap:7px;padding:8px 13px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:12.5px;font-weight:700;cursor:pointer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span>إظهار الكل</span></button>'+
        '<span id="valCount" style="margin-inline-start:auto;font-size:12px;color:var(--gold-d);font-weight:700;background:var(--gold-soft);padding:5px 12px;border-radius:99px"></span>'+
      '</div></div>'+
      '<div class="card"><div class="scroll"><div class="grid" style="min-width:100%">'+
        '<div class="thead" style="grid-template-columns:minmax(130px,1.2fr) minmax(115px,1.1fr) minmax(90px,.85fr) minmax(95px,.9fr) minmax(95px,.9fr) minmax(125px,1.15fr) 64px"><div class="th">الصك</div><div class="th c">المدينة / الحي</div><div class="th c">أمر العمل</div><div class="th c">تاريخ الإسناد</div><div class="th c">الأطراف</div><div class="th c">الحالة</div><div class="th c">إجراءات</div></div>'+
        '<div id="valRows"></div></div></div>'+
        '<div style="padding:11px 16px;border-top:1px solid var(--border);font-size:12px;color:var(--text-3)">لا يُفعَّل إدخال التقييم إلا بعد اكتمال المعاينة الميدانية لنفس العقار. مصدر سعر التقييم هو المقيم وحده — ويُعرض للأخصائي للاسترشاد به في دراسة الحالة.</div>'+
      '</div>';
    var draw=function(){
      var q=(document.getElementById('valSearch').value||'').trim();
      var fl=document.getElementById('valStatus').value;
      var rows=VAL_TASKS.filter(function(t){
        var st=valStatusOf(t); var grp = st==='submitted'?(t.closedOnSystem?'closed':'submitted') : st==='reopened'?'reopened' : valReadiness(t);
        if(q && (t.deed+' '+t.region).indexOf(q)===-1) return false;
        if(fl && grp!==fl) return false;
        if(!fl && !VALS.showDone && st==='submitted') return false;
        return true;
      }).map(function(t){
        var st=valStatusOf(t), gated=!t.inspected;
        var rd=valReadiness(t);
        var dr=valDraftOf(t);
        var pillHtml = st==='submitted'?(t.closedOnSystem?pill('مكتملة على النظام',GREEN):(dr&&dr.recallPending?'<span title="طلب الاسترجاع بانتظار موافقة الأخصائي">'+pill('بانتظار موافقة الاسترجاع',AMBER)+'</span>':pill('مُرسَلة للأخصائي',NAVY))) : st==='reopened'?pill('مُعاد للتعديل',AMBER) : rd==='ready'?pill('جاهزة للتقييم',GOLD) : rd==='wait_survey'?pill('بانتظار الرفع المساحي',AMBER) : rd==='wait_inspection'?pill('بانتظار المعاينة',GRAY) : pill('جديدة',GRAY);
        var deps=[['المعاين','المعاينة الميدانية',t.inspected,'م']];
        if(valNeedsSurvey(t)) deps.push(['المكتب الهندسي','الرفع المساحي',t.surveyed,'هـ']); 
        var depsHeader='أطراف المعاملة ('+deps.length+')';
        var partiesCell='<div class="team">'+deps.map(function(x,i){ return '<span class="ava" style="background:'+(i===0?'var(--ink)':'var(--gold-d)')+(x[2]?'':';opacity:.35')+'">'+x[3]+'</span>'; }).join('')+
          '<div class="team-pop"><div class="pop-h">'+depsHeader+'</div>'+deps.map(function(x,i){ return '<div class="pop-row"'+(x[2]?'':' style="opacity:.5"')+'><span class="pop-av" style="background:'+(i===0?'var(--ink)':'var(--gold-d)')+'">'+x[3]+'</span><span style="display:inline-flex;flex-direction:column;min-width:0"><span class="pop-name">'+x[0]+'</span><span style="font-size:10.5px;color:var(--text-3);white-space:nowrap">'+x[1]+'</span></span><span style="margin-inline-start:auto">'+(x[2]?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2f7a4d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa0ab" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>')+'</span></div>'; }).join('')+'</div></div>';
        return '<div class="row" data-val-open="'+t.id+'" role="button" '+(gated?' data-dim="1"':'')+' style="grid-template-columns:minmax(130px,1.2fr) minmax(115px,1.1fr) minmax(90px,.85fr) minmax(95px,.9fr) minmax(95px,.9fr) minmax(125px,1.15fr) 64px;min-height:40px;cursor:pointer">'+
          '<div class="td"><div style="display:flex;flex-direction:column;gap:2px"><span dir="ltr" style="font-weight:700;color:var(--gold-d);font-size:13.5px;text-align:end;display:inline-flex;align-items:center;gap:6px;justify-content:flex-end">'+esc(t.deed)+(st==='draft'&&!localStorage.getItem('val_draft_'+t.id)?'<span style="width:8px;height:8px;border-radius:99px;background:#2f7de1;animation:newDot 1.1s ease-in-out infinite;flex:none" title="معاملة جديدة — لم يُتخذ عليها إجراء"></span>':'')+'</span><span style="color:var(--text-3);font-size:11.5px">'+esc(t.kind)+'</span></div></div>'+
          '<div class="td c" style="font-size:13px;text-align:center">'+esc(t.region)+'</div>'+
          '<div class="td c" dir="ltr" style="font-size:12px;color:var(--text-2)">'+esc(t.po)+'</div>'+
          '<div class="td c" dir="ltr" style="font-size:12.5px;color:var(--text-2)">'+esc(t.assigned)+'</div>'+
          '<div class="td c" style="overflow:visible">'+partiesCell+'</div>'+
          '<div class="td c">'+pillHtml+'</div>'+
          '<div class="td"><div class="actions"><button class="kebab" aria-label="إجراءات التقييم"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button><div class="act-pop">'+
            '<div class="act-row" data-val-menu="open" data-val-id="'+t.id+'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span>بيانات العقار</span></div>'+
            (st!=='submitted'?'<div class="act-row" data-val-menu="work" data-val-id="'+t.id+'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span>رفع تقرير التقييم</span></div>':'')+
            (st==='submitted'&&!(dr&&dr.recallPending)&&!t.closedOnSystem?'<div class="act-sep"></div><div class="act-row" data-val-recall="'+t.id+'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 3v6h6"/></svg><span>طلب استرجاع المعاملة</span></div>':'')+
            (st==='submitted'&&t.closedOnSystem?'<div class="act-sep"></div><div class="act-row" style="opacity:.5;cursor:default" title="رُفعت المعاملة وأُقفلت على النظام — لا يمكن الاسترجاع"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>أُقفلت — لا استرجاع</span></div>':'')+
          '</div></div></div>'+
        '</div>';
      });
      document.getElementById('valRows').innerHTML = rows.length? rows.join('') : '<div style="padding:44px 16px;text-align:center;color:var(--text-3);font-size:13.5px">لا توجد مهام تقييم مطابقة.</div>';
      document.getElementById('valCount').textContent = rows.length+' عقار';
    };
    document.getElementById('valSearch').addEventListener('input', draw);
    document.getElementById('valStatus').addEventListener('change', draw);
    document.getElementById('valShowDone').addEventListener('click', function(){ VALS.showDone=!VALS.showDone; var on=VALS.showDone; this.style.background=on?'var(--ink)':'var(--surface)'; this.style.color=on?'#fff':'var(--text-2)'; this.style.borderColor=on?'var(--ink)':'var(--border-2)'; this.querySelector('span').textContent=on?'عرض قائمة العمل':'إظهار الكل'; draw(); });
    draw();
    setHeader('تقييم العقار', crumb(['لوحة التحكم','تقييم العقار']));
    navActive('تقييم العقار'); showView('generic');
  }
  function valCopyField(label,val){
    return '<div style="'+ENG_BOX+';position:relative"><div style="font-size:10.5px;color:var(--text-3);margin-bottom:3px">'+label+'</div>'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="font-size:12.5px;font-weight:600;color:var(--text)">'+val+'</div>'+
      '<button data-val-copyfield="'+esc(val)+'" title="نسخ '+label+'" style="border:none;background:none;cursor:pointer;color:var(--text-3);padding:2px;display:inline-flex;flex:none" onmouseover="this.style.color=\'var(--gold-d)\'" onmouseout="this.style.color=\'var(--text-3)\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div></div>';
  }
  function valUploadBox(key,title,hint,fname,ro){
    return (ro?'':'<div style="border:2px dashed var(--border-2);background:var(--surface-2);border-radius:10px;padding:16px;text-align:center">'+
      '<div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:3px">'+title+'</div>'+
      '<div style="font-size:11px;color:var(--text-3);margin-bottom:10px">'+hint+'</div>'+
      '<button class="primary" data-val-pick="'+key+'" style="padding:6px 16px;font-size:11.5px">اختيار ملف</button></div>')+
      (fname?'<div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:#d5f5ef;border:1px solid #a9dfbf;border-radius:8px;padding:8px 12px;font-size:12px"><span>📎 '+esc(fname)+'</span>'+(ro?'':'<button data-val-clear="'+key+'" style="border:none;background:none;color:var(--text-3);cursor:pointer;font-size:14px">✕</button>')+'</div>'
       :(ro?'<div style="font-size:12px;color:var(--text-3);padding:6px 2px">لم يُرفع أي ملف.</div>':''));
  }
  function valInput(key,label,val,ro,opts){
    opts=opts||{};
    return '<div style="display:flex;flex-direction:column;gap:5px"><label class="tf-lbl">'+label+'</label><input data-val-f="'+key+'" '+(opts.ltr?'dir="ltr" ':'')+(opts.type?'type="'+opts.type+'" ':'')+(ro?'disabled ':'')+'value="'+esc(val)+'" style="'+INP_STYLE+';width:100%"'+(opts.ph?' placeholder="'+opts.ph+'"':'')+'></div>';
  }
  function renderValWin(taskId, tab){
    if(taskId){ VALS.task=VAL_TASKS.find(function(t){ return t.id===taskId; }); VALS.tab=tab||'valuation'; VALS.err=null; VALS.fieldErr={}; }
    var t=VALS.task; if(!t) return;
    if(VALS.draftId!==t.id){ VALS.draft=valLoad(t.id); VALS.draftId=t.id; if(t.demoStatus&&!localStorage.getItem('val_draft_'+t.id)){ VALS.draft.status=t.demoStatus; if(t.returnNote) VALS.draft.returnNote=t.returnNote; } }
    var d=VALS.draft, fe=VALS.fieldErr, gated=!t.inspected, locked=d.status==='submitted', ro=locked||gated;
    var tabs=[['property','بيانات العقار'],['valuation','التقييم'],['infath','بيانات الرفع لإنفاذ'],['checklist','قائمة الفحص']];
    var tabBar='<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:18px;overflow-x:auto">'+tabs.map(function(x){
      var on=VALS.tab===x[0];
      return '<button data-val-tab="'+x[0]+'" style="border:none;background:none;cursor:pointer;font-family:inherit;padding:10px 14px;font-size:12.5px;margin-bottom:-1px;border-bottom:2px solid '+(on?'var(--gold-d)':'transparent')+';color:'+(on?'var(--heading)':'var(--text-2)')+';font-weight:'+(on?'700':'500')+'">'+x[1]+'</button>';
    }).join('')+'</div>';
    var errLine=function(k){ return fe[k]?'<p style="margin:4px 0 0;font-size:11px;color:#a5432e">'+fe[k]+'</p>':''; };
    var body='';
    if(VALS.tab==='property'){
      body=engInfo('تُستخدم هذه البيانات لتسجيل أمر عمل تقييم عقاري جديد في برنامج المقياس — انسخ كل حقل بأيقونته ثم أكمل التقييم هناك وارفع تقريره في تبويب «التقييم».')+
        engSection('بيانات الصك')+
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+valCopyField('رقم الصك',esc(t.deed))+valCopyField('أمر العمل',esc(t.po))+valCopyField('التصنيف',esc(t.kind))+valCopyField('المدينة / الحي',esc(t.region))+valCopyField('تاريخ الإسناد',esc(t.assigned))+engField('حالة المعاينة',t.inspected?pill('مكتملة',GREEN):pill('غير مكتملة',RED))+'</div>'+
        engSection('مستندات المعاملة — تُضاف من جميع الأطراف أثناء العمل')+
        '<div style="font-size:11.5px;color:var(--text-3);margin:-4px 0 10px">تتحدّث القائمة تلقائياً كلما أضاف طرف مستنداً — مثل التقرير المساحي عند إصداره من المكتب الهندسي.</div>'+
        '<div style="display:grid;gap:8px">'+[
          ['صورة الصك','مركز الإسناد والتصفية','PDF · 1.2 MB',true,'أُضيف '+t.assigned,''],
          ['كروكي الموقع / المخطط','أخصائي دراسة الحالة','PDF · 3.4 MB',true,'أُضيف '+t.assigned,''],
          ['التقرير المساحي','المكتب الهندسي','PDF · 2.1 MB',t.id==='AP-101'||t.id==='AP-102','أُضيف 2026/07/21','يُضاف عند إصدار الرفع المساحي'],
          ['تقرير المعاينة الميدانية بالصور','المعاين الميداني','PDF · 8.6 MB',t.inspected,'أُضيف 2026/07/22','يُضاف عند اكتمال المعاينة']
        ].map(function(doc){
          var avail=doc[3];
          return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:9px 12px'+(avail?'':';opacity:.6')+'">'+
            '<div style="display:flex;align-items:center;gap:9px;min-width:0"><span style="flex:none;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;background:color-mix(in srgb,var(--gold) 14%,transparent);color:var(--gold-d);font-size:9px;font-weight:800">PDF</span>'+
            '<span style="display:inline-flex;flex-direction:column;gap:1px;min-width:0"><span style="font-size:12.5px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+doc[0]+'</span><span style="font-size:10.5px;color:var(--text-3)">'+doc[1]+(avail?' · <span dir="ltr">'+doc[2]+'</span> · '+doc[4]:'')+'</span></span></div>'+
            (avail?'<button data-val-doc="'+doc[0]+'" style="flex:none;display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>تنزيل</button>'
              :'<span style="flex:none;font-size:10.5px;color:var(--text-3)">'+doc[5]+'</span>')+
          '</div>'; }).join('')+'</div>';
    } else if(VALS.tab==='valuation'){
      body=(d.status==='reopened'?engInfo('<strong>⚠ أُعيدت المعاملة من الأخصائي للتعديل</strong> — يمكنك تعديل جميع الحقول وإعادة الإرسال.'+(d.returnNote?'<br>ملاحظة الأخصائي: '+esc(d.returnNote):''),'amber'):'')+
        (VALS.err?engInfo('<strong>!</strong> '+VALS.err,'red'):'')+
        (locked?engInfo('تم الإرسال لأخصائي دراسة الحالة — لا يمكن التعديل إلا بإعادة فتح من الأخصائي.','amber'):'')+
        engSection('تقرير التقييم (المقياس)')+
        '<div style="display:grid;grid-template-columns:260px 1fr;gap:12px;align-items:start;margin-bottom:12px"><div style="display:flex;flex-direction:column;gap:5px"><label class="tf-lbl">رقم التقرير <span style="color:#a5432e">*</span></label><input data-val-f="reportNo" dir="ltr" '+(ro?'disabled ':'')+'value="'+esc(d.reportNo||'')+'" placeholder="مثال: RPT-2026-1045" style="'+INP_STYLE+';width:100%">'+errLine('reportNo')+'</div></div>'+
        valUploadBox('report','رفع تقرير التقييم','PDF صادر من برنامج المقياس · حتى 20 ميجابايت · ملف واحد لكل عقار',d.report,ro)+errLine('report')+
        engSection('تقدير القيمة')+
        (function(){
          var num=function(key,label,req,unit,wordsId){ unit=unit||'ر.س';
            return '<div style="display:flex;flex-direction:column;gap:5px"><label class="tf-lbl">'+label+(req?' <span style="color:#a5432e">*</span>':'')+'</label>'+
              '<div style="display:flex;align-items:stretch;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface)"><input data-val-f="'+key+'" dir="ltr" inputmode="decimal" '+(ro?'disabled ':'')+'value="'+esc(d[key])+'" placeholder="0" style="border:none;outline:none;flex:1;min-width:0;padding:8px 12px;font-size:13.5px;font-weight:700;font-family:inherit;background:transparent;color:var(--text)"><span style="display:flex;align-items:center;padding:0 11px;background:var(--surface-2);border-inline-start:1px solid var(--border);font-size:11.5px;font-weight:700;color:var(--text-2)">'+unit+'</span></div>'+
              (wordsId?'<span id="'+wordsId+'" style="font-size:10px;color:var(--text-3);line-height:1.5;min-height:15px">'+(d[key]?valTafqit(d[key]):'')+'</span>':'')+errLine(key)+'</div>'; };
          var forced=valForced(d);
          return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">'+
            num('landValue','قيمة الأرض',1,'ر.س','valW_land')+
            num('buildingValue','قيمة المباني',1,'ر.س','valW_building')+
            num('price','إجمالي قيمة العقار',1,'ر.س','valW_price')+
          '</div>'+
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px;align-items:start">'+
            num('discount','نسبة خصم البيع القسري',1,'%')+
            '<div style="grid-column:span 2;display:flex;flex-direction:column;gap:5px"><span class="tf-lbl">قيمة البيع القسري</span><div style="'+ENG_BOX+';display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:37px"><span id="valW_forcedNum" dir="ltr" style="font-size:13.5px;font-weight:700;color:var(--heading)">'+forced.toLocaleString('en-US')+'</span><span id="valW_forced" style="font-size:10px;color:var(--text-3);text-align:start;line-height:1.5">'+(forced?valTafqit(forced):'')+'</span></div></div>'+
          '</div>';
        })()+
        engSection('ملاحظات')+
        '<div><label class="tf-lbl">ملاحظات على العقار (اختياري)</label><textarea data-val-f="notes" rows="3" '+(ro?'disabled ':'')+'placeholder="أي ملاحظات على العقار…" style="'+INP_STYLE+';width:100%;resize:vertical">'+esc(d.notes)+'</textarea></div>'+
        (ro?'':'<div style="margin-top:20px"><button class="primary" data-val-submit style="padding:9px 22px;font-size:13px">إرسال للأخصائي</button></div>');
    } else if(VALS.tab==='infath'){
      body=engSection('بيانات الرفع لإنفاذ (المقيّم)')+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
          valInput('appraisalDate','تاريخ التقييم',d.appraisalDate,ro,{type:'date'})+
          valInput('reportIssueDate','تاريخ إصدار التقرير',d.reportIssueDate,ro,{type:'date'})+
          valInput('method','الأسلوب المستخدم',d.method,ro)+
          valInput('basis','أساس القيمة',d.basis,ro)+
        '</div>'+
        engInfo('قيم الأرض والمباني ونسبة خصم البيع القسري تُدخل في تبويب «التقييم» — قسم تقدير القيمة.')+
        '<div style="margin-top:12px">'+valInput('demand','حجم الطلب على العقار',d.demand,ro)+'</div>'+
        '<div style="margin-top:12px;display:flex;flex-direction:column;gap:5px"><label class="tf-lbl">نطاق البحث ومصادر معلومات القيم</label><textarea data-val-f="searchScope" rows="3" '+(ro?'disabled ':'')+'style="'+INP_STYLE+';width:100%;resize:vertical">'+esc(d.searchScope)+'</textarea></div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">'+
          engField('عنوان المقيم — من إعدادات النظام','جدة — حي الروضة، شارع الأمير سلطان، مبنى 42')+
          engField('رقم تواصل المقيّم — من إعدادات النظام','0126612345',1)+
        '</div>'+
        engSection('صورة الأصل من المخطط')+
        valUploadBox('planImage','رفع ملف المخطط','PDF أو صورة · حتى 20 ميجابايت',d.planImage,ro);
    } else if(VALS.tab==='checklist'){
      var yn=function(id,val){ return '<div style="display:flex;justify-content:center;gap:12px">'+[['true','نعم'],['false','لا']].map(function(v){ return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:11.5px"><input type="radio" name="valq_'+id+'" data-val-q="'+id+'" value="'+v[0]+'" '+(String(val)===v[0]?'checked':'')+(ro?' disabled':'')+' style="accent-color:var(--gold-d)">'+v[1]+'</label>'; }).join('')+'</div>'; };
      var rowHtml=function(q,i,extra){ return '<tr><td style="border-bottom:1px solid var(--border);padding:8px 12px;text-align:center;color:var(--text-3)">'+i+'</td>'+
        '<td style="border-bottom:1px solid var(--border);padding:8px 12px;line-height:1.6;color:var(--text)">'+q[1]+(extra||'')+'</td>'+
        '<td style="border-bottom:1px solid var(--border);padding:8px 12px;width:110px">'+yn(q[0],d.checklist[q[0]])+'</td></tr>'; };
      var n=0, cl=d.checklist;
      var sharedExtra = cl.q_shared_deed===true ? '<div style="margin-top:9px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;display:grid;gap:9px">'+
          '<div style="display:flex;gap:14px;align-items:center"><span style="font-size:11.5px;font-weight:700;color:var(--text-2)">نطاق الملكية *</span>'+[['full','كامل المساحة'],['part','جزء محدد']].map(function(v){ return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:11.5px"><input type="radio" name="valq_scope" data-val-scope value="'+v[0]+'" '+(cl.shared_deed_scope===v[0]?'checked':'')+(ro?' disabled':'')+' style="accent-color:var(--gold-d)">'+v[1]+'</label>'; }).join('')+'</div>'+
          (cl.shared_deed_scope==='part'?'<div style="max-width:260px"><label class="tf-lbl">نسبة الملكية * (مثال: 3/8 أو 37.5%)</label><input data-val-pct dir="ltr" '+(ro?'disabled ':'')+'value="'+esc(cl.shared_deed_percentage)+'" style="'+INP_STYLE+';width:100%">'+errLine('shared_deed_percentage')+'</div>':'')+errLine('shared_deed_scope')+'</div>' : '';
      var leaseExtra = cl.q_lease_exists===true ? '<div style="margin-top:9px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;display:flex;gap:14px;align-items:center"><span style="font-size:11.5px;font-weight:700;color:var(--text-2)">هل عقد الإيجار ساري المفعول؟ *</span>'+[['true','نعم'],['false','لا']].map(function(v){ return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:11.5px"><input type="radio" name="valq_lease" data-val-lease value="'+v[0]+'" '+(String(cl.q_lease_active)===v[0]?'checked':'')+(ro?' disabled':'')+' style="accent-color:var(--gold-d)">'+v[1]+'</label>'; }).join('')+errLine('q_lease_active')+'</div>' : '';
      var techExtra = cl.q_technical_notes_exists===true ? '<div style="margin-top:9px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px"><label class="tf-lbl">وصف الملاحظات الفنية *</label><textarea data-val-tech rows="2" '+(ro?'disabled ':'')+'style="'+INP_STYLE+';width:100%;resize:vertical">'+esc(cl.technical_notes_text)+'</textarea>'+errLine('technical_notes_text')+'</div>' : '';
      body=engSection('قائمة فحص المقيم — 14 بنداً')+errLine('checklist')+
        '<div class="scroll"><table style="width:100%;border-collapse:collapse;font-size:11.5px">'+
        '<thead><tr>'+['#','البند','نعم / لا'].map(function(x,i){ return '<th style="background:var(--surface-2);padding:8px 12px;font-size:11px;font-weight:600;color:var(--text-2);text-align:'+(i===0?'center':'right')+';'+(i===0?'width:34px':(i===2?'width:110px':''))+'">'+x+'</th>'; }).join('')+'</tr></thead><tbody>'+
        VAL_Q_SIMPLE.map(function(q){ n++; return rowHtml(q,n); }).join('')+
        rowHtml(VAL_Q_COND[0],++n,sharedExtra)+
        rowHtml(VAL_Q_COND[1],++n,leaseExtra)+
        rowHtml(VAL_Q_COND[2],++n,techExtra)+
        '</tbody></table></div>';
    }
    document.getElementById('view-valWin').innerHTML=
      '<button class="back-link" data-val-back="1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg> العودة إلى قائمة التقييم</button>'+
      '<div class="pp-head" style="margin-bottom:14px"><h1 class="pp-title"><span>نافذة المقيم العقاري</span><span class="pp-po">صك '+esc(t.deed)+'</span></h1>'+
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px"><span class="chip">'+esc(t.po)+'</span>'+pill(VAL_ST_LBL[d.status][0],VAL_ST_LBL[d.status][1])+(gated?pill('بانتظار المعاينة',GRAY):'')+'</div></div>'+
      '<div class="card" style="padding:18px 20px">'+tabBar+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+valDeps(t).map(function(dep){ return '<span title="'+esc(dep.wait)+'" style="display:inline-flex;align-items:center;gap:7px;padding:6px 11px;border-radius:8px;font-size:11px;font-weight:700;border:1px solid '+(dep.ok?'color-mix(in srgb,#3f8f5f 30%,transparent)':'var(--border-2)')+';background:'+(dep.ok?'color-mix(in srgb,#3f8f5f 8%,transparent)':'var(--surface-2)')+';color:'+(dep.ok?'#2f7a4d':'var(--text-3)')+'">'+(dep.ok?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>':'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>')+dep.t+'</span>'; }).join('')+'</div>'+
        (gated?'<div style="background:#fef3d7;border:1px solid #fad7a0;color:#7a5b12;border-radius:8px;padding:9px 12px;font-size:11.5px;line-height:1.7;margin-bottom:14px"><strong>⚠ الإدخال معطّل:</strong> لا يُفعَّل إدخال التقييم إلا بعد اكتمال المعاينة الميدانية.</div>':(valNeedsSurvey(t)&&!t.surveyed&&!locked?'<div style="background:color-mix(in srgb,#d9a441 10%,transparent);border:1px solid color-mix(in srgb,#d9a441 30%,transparent);color:#7a5b12;border-radius:8px;padding:9px 12px;font-size:11.5px;line-height:1.7;margin-bottom:14px">ℹ يمكنك التقييم الآن (المعاينة مكتملة) — لكن الرفع المساحي لم يصدر بعد: قد يلزم تعديل التقييم بعد تأكيد حدود العقار من المكتب الهندسي.</div>':''))+
        '<div style="'+(ro&&VALS.tab!=='property'?'opacity:.75':'')+'">'+body+'</div></div>';
    setHeader('المقيم العقاري — نافذة التقييم', crumb(['لوحة التحكم','تقييم العقار','نافذة التقييم']));
    navActive('تقييم العقار'); showView('valWin');
  }
  document.addEventListener('click', function(e){
    var vr=e.target.closest('[data-val-recall]');
    if(vr){ document.querySelectorAll('.actions.open').forEach(function(x){ x.classList.remove('open'); }); var tid=vr.getAttribute('data-val-recall');
      try{ var s=localStorage.getItem('val_draft_'+tid); var dd=s?JSON.parse(s):null; if(!dd){ dd=valNewDraft(); var tk2=VAL_TASKS.find(function(x){ return x.id===tid; }); dd.status=(tk2&&tk2.demoStatus)||'submitted'; } dd.recallPending=true; localStorage.setItem('val_draft_'+tid, JSON.stringify(dd)); }catch(e2){}
      if(VALS.draftId===tid&&VALS.draft) VALS.draft.recallPending=true;
      renderValOrders(); showToast('أُرسل طلب استرجاع المعاملة للأخصائي — تُعاد للتعديل بموافقته ما لم تكن رُفعت وأُقفلت على النظام.'); return; }
    var vm=e.target.closest('[data-val-menu]');
    if(vm){ document.querySelectorAll('.actions.open').forEach(function(x){ x.classList.remove('open'); }); renderValWin(vm.getAttribute('data-val-id'), vm.getAttribute('data-val-menu')==='open'?'property':'valuation'); return; }
    var vo=e.target.closest('[data-val-open]');
    if(vo && !e.target.closest('.kebab')){ renderValWin(vo.getAttribute('data-val-open')); return; }
    var vv=document.getElementById('view-valWin'); if(!vv||vv.hidden) return;
    if(e.target.closest('[data-val-back]')){ renderValOrders(); return; }
    var vt=e.target.closest('[data-val-tab]');
    if(vt){ VALS.tab=vt.getAttribute('data-val-tab'); VALS.err=null; renderValWin(); return; }
    var vp=e.target.closest('[data-val-pick]');
    if(vp){ var key=vp.getAttribute('data-val-pick'); var inp=document.createElement('input'); inp.type='file';
      inp.accept = key==='report' ? '.pdf,application/pdf' : '.pdf,application/pdf,image/*';
      inp.onchange=function(){ if(inp.files[0]){ VALS.draft[key]=inp.files[0].name; delete VALS.fieldErr[key]; valSave(); renderValWin(); } }; inp.click(); return; }
    var vdc=e.target.closest('[data-val-doc]');
    if(vdc){ showToast('بدأ تنزيل «'+vdc.getAttribute('data-val-doc')+'» — أرفقه عند تسجيل الأمر في المقياس.'); return; }
    var cpf=e.target.closest('[data-val-copyfield]');
    if(cpf){ var v=cpf.getAttribute('data-val-copyfield');
      (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(v):Promise.reject()).then(function(){ showToast('نُسخ: '+v); },function(){ showToast('تعذر النسخ التلقائي.'); }); return; }
    var vc=e.target.closest('[data-val-clear]');
    if(vc){ VALS.draft[vc.getAttribute('data-val-clear')]=''; valSave(); renderValWin(); return; }
    if(e.target.closest('[data-val-submit]')){
      var d=VALS.draft, fe={}, cl=d.checklist;
      if(!d.report) fe.report='ارفع تقرير التقييم (PDF من برنامج المقياس)';
      if(!(d.reportNo||'').trim()) fe.reportNo='أدخل رقم تقرير المقياس';
      var pn=parseFloat(String(d.price).replace(/,/g,''));
      if(!String(d.price).trim()||!isFinite(pn)||pn<=0) fe.price='أدخل سعر التقييم — رقم موجب أكبر من صفر';
      var missing=VAL_Q_SIMPLE.concat(VAL_Q_COND).some(function(q){ return cl[q[0]]===null; });
      if(missing) fe.checklist='أكمل جميع بنود قائمة الفحص (14 بنداً)';
      if(cl.q_shared_deed===true && !cl.shared_deed_scope) fe.shared_deed_scope='حدد نطاق الملكية';
      if(cl.shared_deed_scope==='part' && !cl.shared_deed_percentage.trim()) fe.shared_deed_percentage='أدخل نسبة الملكية';
      if(cl.q_lease_exists===true && cl.q_lease_active===null) fe.q_lease_active='حدد سريان عقد الإيجار';
      if(cl.q_technical_notes_exists===true && !cl.technical_notes_text.trim()) fe.technical_notes_text='صف الملاحظات الفنية';
      VALS.fieldErr=fe;
      if(Object.keys(fe).length){ VALS.err=fe.report||fe.reportNo||fe.price||fe.checklist||fe.shared_deed_scope||fe.shared_deed_percentage||fe.q_lease_active||fe.technical_notes_text; if(fe.checklist||fe.shared_deed_scope||fe.shared_deed_percentage||fe.q_lease_active||fe.technical_notes_text){ VALS.tab=(fe.report||fe.reportNo||fe.price)?'valuation':'checklist'; } renderValWin(); showToast(VALS.err); return; }
      d.status='submitted'; VALS.err=null; valSave(); renderValWin(); showToast('تم الإرسال لأخصائي دراسة الحالة — يمكنك إغلاق الشاشة أو العودة للقائمة.'); return; }
  });
  document.addEventListener('input', function(e){
    var vv=document.getElementById('view-valWin'); if(!vv||vv.hidden||!VALS.draft) return;
    var f=e.target.closest('[data-val-f]');
    if(f){ var k=f.getAttribute('data-val-f'); VALS.draft[k]=f.value; delete VALS.fieldErr[k]; valSave();
      if(k==='landValue'||k==='buildingValue'||k==='price'||k==='discount'){
        var d2=VALS.draft, map={landValue:'valW_land',buildingValue:'valW_building',price:'valW_price'};
        if(map[k]){ var el=document.getElementById(map[k]); if(el) el.textContent=d2[k]?valTafqit(d2[k]):''; }
        var fn2=document.getElementById('valW_forcedNum'), fw=document.getElementById('valW_forced'), fv=valForced(d2);
        if(fn2) fn2.textContent=fv.toLocaleString('en-US'); if(fw) fw.textContent=fv?valTafqit(fv):'';
      } return; }
    var pc=e.target.closest('[data-val-pct]'); if(pc){ VALS.draft.checklist.shared_deed_percentage=pc.value; delete VALS.fieldErr.shared_deed_percentage; valSave(); return; }
    var tn=e.target.closest('[data-val-tech]'); if(tn){ VALS.draft.checklist.technical_notes_text=tn.value; delete VALS.fieldErr.technical_notes_text; valSave(); return; }
  });
  document.addEventListener('change', function(e){
    var vv=document.getElementById('view-valWin'); if(!vv||vv.hidden||!VALS.draft) return;
    var q=e.target.closest('[data-val-q]');
    if(q){ VALS.draft.checklist[q.getAttribute('data-val-q')]=(q.value==='true'); delete VALS.fieldErr.checklist; valSave(); renderValWin(); return; }
    var sc=e.target.closest('[data-val-scope]'); if(sc){ VALS.draft.checklist.shared_deed_scope=sc.value; delete VALS.fieldErr.shared_deed_scope; valSave(); renderValWin(); return; }
    var la=e.target.closest('[data-val-lease]'); if(la){ VALS.draft.checklist.q_lease_active=(la.value==='true'); delete VALS.fieldErr.q_lease_active; valSave(); return; }
  });

  function goPoList(){
    setHeader('أوامر العمل (PO)', crumb(['لوحة التحكم','دراسة الحالة','أوامر العمل']));
    navActive('أوامر العمل (PO)');
    showView('po');
  }

  /* ═══════════ طبقة المهام (Tasks) ═══════════ */
  var ASSIGNEES = [
    { id:'u1', name:'فراس كمرين', role:'مراجع حكومي' },
    { id:'u2', name:'أحمد سعيد', role:'معاين ميداني' },
    { id:'u3', name:'عبدالله عبدالمانع', role:'معاين ميداني' },
    { id:'u4', name:'عبدالله الكثيري', role:'مقيم عقاري' },
    { id:'u5', name:'أسامة الصالحي', role:'أخصائي دراسة حالة' },
    { id:'u6', name:'محمد دياب', role:'منسق عمليات التقييم' },
    { id:'u7', name:'إيمان النهدي', role:'موظف الشؤون المالية' },
    { id:'u8', name:'عبدالرحمن النفيعي', role:'مشرف قسم دراسة الحالة' },
    { id:'u9', name:'سالم الغريب', role:'مدير إدارة التقييم العقاري' },
    { id:'u10', name:'مكتب جدة للمساحة', role:'مقدم خدمة — جهة' }
  ];
  var TASK_TYPES = {
    court_visit:{ label:'زيارة محكمة', letter:true, ico:'<path d="M3 21h18M6 21V10M18 21V10M4 10h16L12 3z"/><path d="M9 21v-5h6v5"/>' },
    inquiry:{ label:'استفسار', ico:'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>' },
    general:{ label:'مهمة', ico:'<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/><path d="M9 11l3 3L22 4"/>' }
  };
  var TASK_SCOPES = { transaction:'معاملة', work_order:'أمر عمل', multi:'عدة معاملات', general:'عامة' };
  var TASK_STATUS = { in_progress:{t:'قيد التنفيذ',c:GOLD}, paused:{t:'متوقفة مؤقتاً',c:'#8a8d96'}, completed:{t:'منجزة',c:GREEN}, cancelled:{t:'ملغاة',c:RED} };
  var TASK_TERMINAL = { completed:1, cancelled:1 };
  function taskActive(t){ return t.status==='in_progress'||t.status==='paused'; }
  var TASK_PRIORITY = { high:{t:'عالية',c:'#d9694f',off:4*3600000}, medium:{t:'متوسطة',c:'#d9a441',off:DAY/2}, low:{t:'منخفضة',c:'#8a8d96',off:DAY} };
  var TASK_REMIND = { high:{label:'كل ساعة ضمن الدوام'}, medium:{label:'مراجعة منتصف/نهاية الدوام'}, low:{label:'مراجعة يوم العمل التالي'} };
  var WH_START=8, WH_END=17, WH_NOON=12;
  function isWorkDay(d){ var g=d.getDay(); return g>=0 && g<=4; } // الأحد–الخميس
  function atHour(d,h){ return new Date(d.getFullYear(),d.getMonth(),d.getDate(),h,0,0,0).getTime(); }
  function nextWorkDayNoon(ts){ var d=new Date(ts); do{ d.setDate(d.getDate()+1); }while(!isWorkDay(d)); return atHour(d,WH_NOON); }
  function nextCheckpoint(ts){
    var d=new Date(ts), h=d.getHours()+d.getMinutes()/60;
    if(isWorkDay(d)){ if(h < WH_NOON) return atHour(d,WH_NOON); if(h < WH_END) return atHour(d,WH_END); }
    return nextWorkDayNoon(ts);
  }
  function nextWorkHour(ts){
    var d=new Date(ts);
    if(isWorkDay(d) && d.getHours() < WH_START) return atHour(d,WH_START);
    var cand=new Date(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours()+1,0,0,0);
    if(isWorkDay(cand) && cand.getHours()>=WH_START && cand.getHours()<=WH_END) return cand.getTime();
    var nd=new Date(ts); do{ nd.setDate(nd.getDate()+1); }while(!isWorkDay(nd)); return atHour(nd,WH_START);
  }
  var CREATOR = 'سليمان الصالحي — مسؤول التحول الرقمي (CDO)';

  var TASKS = [
    { id:'T-2041', type:'court_visit', title:'زيارة محكمة التنفيذ لتفويض صكوك جدة', desc:'مراجعة دوائر التنفيذ بجدة ومكة واستلام صور الصكوك المطلوبة للمعاملات المدرجة في الخطاب.', scope:'multi', deeds:['88120044991','21324354657','10203040506'], assignee:'u1', createdAt: NOW - 1*DAY, dueAt: NOW + 1*DAY + 12*3600000, status:'in_progress', ref:'خ.ت-2026-0041', priority:'high',
      letterRows:[
        { po:'PO-2026-7', deed:'88120044991', owner:'سارة القرشي', request:'100233', court:'محكمة التنفيذ بجدة', circuit:'الدائرة الأولى' },
        { po:'PO-2026-7', deed:'21324354657', owner:'خالد باوزير', request:'100241', court:'محكمة التنفيذ بجدة', circuit:'الدائرة الأولى' },
        { po:'PO-004', deed:'10203040506', owner:'محمد الغامدي', request:'100205', court:'محكمة التنفيذ بمكة', circuit:'الدائرة الثانية' }
      ] },
    { id:'T-2039', type:'general', title:'إعادة تصوير عقار النسيم', desc:'الصور السابقة غير واضحة — يلزم إعادة تصوير الواجهة الأمامية وصورة الصك بدقة أعلى.', scope:'transaction', deeds:['45500213366'], po:'PO-2026-0005', assignee:'u2', createdAt: NOW - 2*DAY, dueAt: NOW + 5*3600000, status:'in_progress', priority:'medium', comments:[
      { who:'creator', at: NOW - 2*DAY + 3600000, text:'يرجى إعادة تصوير الواجهة الأمامية وصورة الصك بدقة أعلى.', files:[] },
      { who:'assignee', at: NOW - 1*DAY, text:'تم التوجه للموقع، لكن الإضاءة غير مناسبة اليوم. هل أؤجل للصباح؟', files:[{name:'ملاحظة-الموقع.jpg',size:'420 KB'}] },
      { who:'creator', at: NOW - 1*DAY + 7200000, text:'نعم، صوّر غداً صباحاً وأرفق الصور هنا.', files:[] }
    ] },
    { id:'T-2036', type:'general', title:'زيارة البلدية للاستفسار عن رخصة البناء', desc:'الاستفسار عن حالة رخصة البناء لعقار العزيزية قبل إتمام دراسة الحالة.', scope:'general', assignee:'u3', createdAt: NOW - 1*DAY, dueAt: NOW + 90*60000, status:'in_progress', priority:'low' },
    { id:'T-2030', type:'court_visit', title:'زيارة محكمة التنفيذ بالرياض', desc:'تم استلام صور الصكوك المطلوبة وتسليمها لقسم دراسة الحالة.', scope:'work_order', po:'PO-2026-0005', deeds:['45500213366'], assignee:'u1', createdAt: NOW - 6*DAY, dueAt: NOW - 3*DAY + 12*3600000, status:'completed', ref:'خ.ت-2026-0030', priority:'medium',
      letterRows:[ { po:'PO-2026-0005', deed:'45500213366', owner:'عبدالعزيز الشهري', request:'100218', court:'محكمة التنفيذ بالرياض', circuit:'الدائرة الثالثة' } ],
      comments:[ { who:'assignee', at: NOW - 3*DAY + 11*3600000, text:'تم استلام صور الصكوك المطلوبة وتسليمها لقسم دراسة الحالة.', files:[{name:'صور-الصكوك.pdf',size:'1.2 MB'}], kind:'close' } ] },
    { id:'T-2028', type:'inquiry', title:'استفسار عن رقم الطلب في البورصة', desc:'', scope:'transaction', deeds:['12009887654'], po:'PO-001', assignee:'u5', createdAt: NOW - 7*DAY, dueAt: NOW - 5*DAY + 11*3600000, status:'completed', priority:'low' }
  ];

  TASKS.forEach(function(t){ if(t.status==='created') t.status='in_progress'; });
  function asg(id){ for(var i=0;i<ASSIGNEES.length;i++) if(ASSIGNEES[i].id===id) return ASSIGNEES[i]; return {name:'—',role:''}; }
  function asgName(id){ return asg(id).name; }
  function asgRole(id){ return asg(id).role; }
  function taskLive(){ return NOW + (Date.now() - BOOT); }
  function isoFromTs(ts){ var d=new Date(ts); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
  function taskDueLabel(ts){
    var d=new Date(ts), h=d.getHours(), h12=h%12||12;
    return WEEKDAYS[d.getDay()]+' '+pad2(d.getDate())+'/'+pad2(d.getMonth()+1)+' · '+h12+':'+pad2(d.getMinutes())+' '+(h<12?'ص':'م');
  }
  function taskScopeText(t){
    if(t.scope==='transaction') return 'صك '+((t.deeds&&t.deeds[0])||'—');
    if(t.scope==='work_order') return t.po||'—';
    if(t.scope==='multi') return (t.deeds?t.deeds.length:0)+' صكوك';
    return 'غير مرتبطة';
  }
  function typeIco(type,size){ var ty=TASK_TYPES[type]; return '<svg width="'+(size||16)+'" height="'+(size||16)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+ty.ico+'</svg>'; }
  function synthLetterRow(deed){
    var t=null; for(var i=0;i<ALL_TX.length;i++){ if(ALL_TX[i].deed===deed){ t=ALL_TX[i]; break; } }
    var city=t?t.city:'—', po=t?t.po:'—', h=0;
    for(var j=0;j<deed.length;j++) h=(h*31+deed.charCodeAt(j))>>>0;
    return { po:po, deed:deed, owner:OWNERS[h%OWNERS.length], request:String(100200+(h%800)),
      court:'محكمة التنفيذ ب'+city.split(' ')[0], circuit:'الدائرة '+['الأولى','الثانية','الثالثة'][h%3] };
  }
  function updateTaskBadge(){
    var n=TASKS.filter(function(t){ return taskActive(t); }).length;
    var el=document.getElementById('taskBadge'); if(el){ el.textContent=n; el.style.display=n?'grid':'none'; }
  }

  // ── سجل المهام ──
  var TASK_STATE = { search:'', status:'', scope:'', showAll:false };
  var TASK_SEL = {};
  function taskKebab(t){
    var id=esc(t.id), items='';
    var I=function(p){ return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>'; };
    items+='<div class="act-row" data-task-act="detail" data-task-id="'+id+'">'+I('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>')+'<span>عرض التفاصيل</span></div>';
    if(t.status==='in_progress'||t.status==='paused') items+='<div class="act-row" data-task-close="'+id+'">'+I('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>')+'<span>إغلاق المهمة</span></div>';
    if(t.status==='in_progress') items+='<div class="act-row" data-task-act="pause" data-task-id="'+id+'">'+I('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>')+'<span>إيقاف مؤقت</span></div>';
    if(t.status==='paused') items+='<div class="act-row" data-task-act="resume" data-task-id="'+id+'">'+I('<polygon points="5 3 19 12 5 21 5 3"/>')+'<span>استئناف المهمة</span></div>';
    if(TASK_TYPES[t.type].letter) items+='<div class="act-row" data-task-act="letter" data-task-id="'+id+'">'+I('<path d="M3 21h18M6 21V10M18 21V10M4 10h16L12 3z"/>')+'<span>عرض خطاب التفويض</span></div>';
    if(taskActive(t)) items+='<div class="act-row" data-remind="'+id+'">'+I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>')+'<span>تذكير المنفّذ</span></div>';
    if(taskActive(t)) items+='<div class="act-row" data-task-prio="'+id+'">'+I('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>')+'<span>تغيير الأولوية</span></div>';
    if(taskActive(t)) items+='<div class="act-row" data-task-reassign="'+id+'">'+I('<path d="M5 12h14M13 6l6 6-6 6"/>')+'<span>إعادة توجيه وإسناد</span></div>';
    if(!TASK_TERMINAL[t.status]) items+='<div class="act-sep"></div><div class="act-row danger" data-task-act="cancel" data-task-id="'+id+'">'+I('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>')+'<span>إلغاء المهمة (للمنشئ)</span></div>';
    return '<div class="actions"><button class="kebab" aria-label="خيارات المهمة"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button><div class="act-pop">'+items+'</div></div>';
  }
  function taskRow(t){
    var st=TASK_STATUS[t.status], ty=TASK_TYPES[t.type], pr=TASK_PRIORITY[t.priority]||TASK_PRIORITY.medium;
    var overdue=!TASK_TERMINAL[t.status] && t.dueAt < taskLive();
    var cols='40px minmax(170px,1.8fr) minmax(110px,1.1fr) minmax(120px,1.1fr) minmax(120px,1.2fr) minmax(84px,.85fr) 84px';
    var check=taskActive(t)?'<label class="tk-check" onclick="event.stopPropagation()"><input type="checkbox" data-tk-sel="'+esc(t.id)+'"'+(TASK_SEL[t.id]?' checked':'')+'></label>':'';
    var quickRemind=taskActive(t)?'<button class="remind-mini" data-remind="'+esc(t.id)+'" title="تذكير المنفّذ" aria-label="تذكير"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></button>':'';
    var cd=taskCountdown(t), u=taskUrgency(t);
    var dueCell = !taskActive(t)
      ? '<div class="td"><span class="date">'+(t.status==='paused'?'متوقفة':'—')+'</span></div>'
      : '<div class="td"><div class="cd-wrap"><span class="cd-dot'+(u.pulse?' live':'')+'" style="background:'+u.c+'"></span><span class="due-cd" data-cd="'+esc(t.id)+'" style="font-size:12.5px;font-weight:700;'+(cd.over?'color:#d9694f':'color:var(--heading)')+'">'+cd.txt+'</span><span class="cd-tip">الاستحقاق: '+esc(taskDueLabel(t.dueAt))+'</span></div></div>';
    return '<div class="row" data-task-open="'+esc(t.id)+'" style="grid-template-columns:'+cols+';cursor:pointer">'+
      '<div class="td c" onclick="event.stopPropagation()">'+check+'</div>'+
      '<div class="td"><div style="display:flex;align-items:center;gap:11px"><span style="width:30px;height:30px;border-radius:8px;flex:none;display:grid;place-items:center;background:var(--gold-soft);color:var(--gold-d)">'+typeIco(t.type,15)+'</span><div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-weight:700;color:var(--heading);font-size:13.5px">'+esc(t.title)+'</span><span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-3);font-size:11.5px"><span dir="ltr">'+esc(t.id)+'</span><span>·</span><span>'+esc(ty.label)+'</span><span>·</span><span style="display:inline-flex;align-items:center;gap:4px;color:'+pr.c+';font-weight:700"><span style="width:6px;height:6px;border-radius:50%;background:'+pr.c+'"></span>'+pr.t+'</span></span></div></div></div>'+
      '<div class="td"><div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:13px;font-weight:600;color:var(--text)">'+esc(TASK_SCOPES[t.scope])+'</span><span dir="ltr" style="font-size:11.5px;color:var(--text-3)">'+esc(taskScopeText(t))+'</span></div></div>'+
      '<div class="td"><div style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:600;color:var(--heading);font-size:13px">'+esc(asgName(t.assignee))+'</span><span style="color:var(--text-3);font-size:11.5px">'+esc(asgRole(t.assignee))+'</span></div></div>'+
      dueCell+
      '<div class="td">'+pill(st.t,st.c)+'</div>'+
      '<div class="td"><div style="display:flex;align-items:center;gap:2px;justify-content:center;width:100%">'+quickRemind+taskKebab(t)+'</div></div>'+
    '</div>';
  }
  