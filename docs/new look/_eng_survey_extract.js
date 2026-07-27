function renderEngSurvey(office, tab, mode, done, deed, po, gate, gateReason){
    if(office) { ENGS.office=office; ENGS.tab=tab||'survey'; ENGS.mode=mode||'work'; ENGS.done=!!done; ENGS.gate=!!gate; ENGS.gateReason=gateReason||''; ENGS.deed=deed||ENGS.deed||'88120044991'; ENGS.po=po||ENGS.po||'PO-2026-0005'; ENGS.err=null; ENGS.fieldErr={}; }
    if(!ENGS.draft||ENGS.draftDeed!==ENGS.deed){ ENGS.draft=engLoad(ENGS.deed); ENGS.draftDeed=ENGS.deed; }
    var d=ENGS.draft, fe=ENGS.fieldErr, locked=d.status==='submitted'||ENGS.done, viewOnly=ENGS.mode==='view', ro=locked||viewOnly||ENGS.gate;
    var tabs=[['property','بيانات العقار'],['survey','الرفع المساحي'],['fees','مالية المعاملة'],['notes','ملاحظة'],['failures','التعذرات']];
    var tabBar='<div style="display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:18px;overflow-x:auto">'+tabs.map(function(t){
      var on=ENGS.tab===t[0];
      return '<button data-eng-tab="'+t[0]+'" style="border:none;background:none;cursor:pointer;font-family:inherit;padding:10px 14px;font-size:12.5px;margin-bottom:-1px;border-bottom:2px solid '+(on?'var(--gold-d)':'transparent')+';color:'+(on?'var(--heading)':'var(--text-2)')+';font-weight:'+(on?'700':'500')+'">'+t[1]+(t[0]==='notes'&&d.note?' <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--gold-d);vertical-align:middle"></span>':'')+'</button>';
    }).join('')+'</div>';
    var errLine=function(k){ return fe[k]?'<p style="margin:4px 0 0;font-size:11px;color:#a5432e">'+fe[k]+'</p>':''; };
    var body='';
    if(ENGS.tab==='property'){
      body=engSection('بيانات الصك')+
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+engField('رقم الصك',esc(ENGS.deed),1)+engField('تاريخ الصك','1445/08/12',1)+engField('حالة الصك',pill('فعال',GREEN))+engField('اسم المالك','محمد الغامدي')+engField('حالة الملك','فعال')+engField('القيود على العقار','لا توجد قيود')+'</div>'+
        engSection('بيانات الموقع')+
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+engField('المدينة','جدة')+engField('الحي','الشرفية')+engField('المحكمة / الدائرة','محكمة التنفيذ بجدة / الدائرة الثالثة')+engField('رقم المخطط','ج/102',1)+engField('رقم القطعة','455',1)+engField('توفر الحدود','متوفرة بالصك')+'</div>'+
        engSection('البيانات المساحية')+
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+engField('التصنيف','أرض')+engField('النوع / الاستخدام','سكنية')+engField('المساحة الإجمالية','625 م²')+engField('رقم الطلب','100697',1)+engField('رقم التكليف','TK-2026-118',1)+engField('تاريخ التكليف','2026/07/19',1)+'</div>';
    } else if(ENGS.tab==='survey'){
      body=(d.status==='reopened'&&d.returnNote?engInfo('<strong>⚠ تم إعادة الرفع المساحي — يرجى المراجعة والتصحيح.</strong><br>'+esc(d.returnNote),'amber'):'')+
        (ENGS.err?engInfo('<strong>!</strong> '+ENGS.err,'red'):'')+
        (locked?engInfo('تم إرسال الرفع المساحي لهذا العقار. استخدم «طلب استرجاع المعاملة» لإعادة فتح العمل.','amber'):'')+
        engSection('موقع العقار الميداني')+
        (ro?'':engInfo('ℹ يُستخدم الموقع للتحقق من زيارة المكتب الهندسي. يجب أن تتطابق الإحداثيات مع موقع العقار الفعلي.'))+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'+
          '<div><label class="tf-lbl">خط العرض (Latitude) *</label><input data-eng-f="lat" dir="ltr" value="'+esc(d.lat)+'" style="'+INP_STYLE+';width:100%'+(fe.lat?';border-color:#c0553d':'')+'">'+errLine('lat')+'</div>'+
          '<div><label class="tf-lbl">خط الطول (Longitude) *</label><input data-eng-f="lng" dir="ltr" value="'+esc(d.lng)+'" style="'+INP_STYLE+';width:100%'+(fe.lng?';border-color:#c0553d':'')+'">'+errLine('lng')+'</div></div>'+
        '<div style="height:170px;border:1px solid var(--border);border-radius:10px;background:repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2) 12px,color-mix(in srgb,var(--surface-2) 60%,var(--surface)) 12px,color-mix(in srgb,var(--surface-2) 60%,var(--surface)) 24px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;margin-bottom:6px">'+
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--gold-d)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'+
          '<div style="font-size:11.5px;color:var(--text-2);direction:ltr">'+esc(d.lat)+' , '+esc(d.lng)+'</div>'+(ro?'':'<div style="font-size:10.5px;color:var(--text-3)">خريطة الموقع — اسحب الدبوس في النظام الفعلي لتحديث الإحداثيات</div>')+'</div>'+
        engSection('الحدود والأطوال (إنفاذ)')+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px"><div><label class="tf-lbl">المساحة على الطبيعة (م²)</label><input data-eng-f="area" value="'+esc(d.area)+'" style="'+INP_STYLE+';width:100%"></div></div>'+
        engBoundRow('nB','nL','الحد الشمالي','طول الحد الشمالي التقريبي (م)',d)+
        engBoundRow('sB','sL','الحد الجنوبي','طول الحد الجنوبي التقريبي (م)',d)+
        engBoundRow('eB','eL','الحد الشرقي','طول الحد الشرقي التقريبي (م)',d)+
        engBoundRow('wB','wL','الحد الغربي','طول الحد الغربي التقريبي (م)',d)+
        '<div><label class="tf-lbl">ملاحظات الرفع المساحي</label><textarea data-eng-f="notes" rows="3" style="'+INP_STYLE+';width:100%;resize:vertical">'+esc(d.notes)+'</textarea></div>'+
        engSection('التقرير المساحي')+engUpload('report','رفع التقرير المساحي','PDF — الحجم الأقصى 20 ميجابايت',d.report,ro)+errLine('report')+
        engSection('خطاب إقرار صحة الموقع')+engUpload('letter','رفع خطاب الإقرار','PDF — الحجم الأقصى 10 ميجابايت',d.letter,ro)+errLine('letter')+
        (ro?'<div style="margin-top:12px;background:#fef3d7;border:1px solid #fad7a0;border-radius:8px;padding:10px 12px;font-size:11.5px;line-height:1.7;color:#7a5b12">'+(d.confirmed?'✓ تم الإقرار بأن المكتب الهندسي تحقق ميدانياً وأن بيانات التقرير المساحي صحيحة ودقيقة.':'لم يتم الإقرار بعد بصحة الموقع.')+'</div>'
         :'<label style="margin-top:12px;display:flex;align-items:flex-start;gap:9px;background:#fef3d7;border:1px solid #fad7a0;border-radius:8px;padding:10px 12px;font-size:11.5px;line-height:1.7;cursor:pointer;color:#7a5b12"><input type="checkbox" data-eng-confirm '+(d.confirmed?'checked':'')+' style="accent-color:var(--gold-d);margin-top:2px">'+
        '<span>أُقرّ بأن المكتب الهندسي تحقق ميدانياً وأن بيانات التقرير المساحي المرفوع <strong>صحيحة ودقيقة</strong>.</span></label>')+errLine('confirmed')+
        engSection('نموذج التحقق الميداني — 13 بنداً')+
        '<div class="scroll"><table style="width:100%;border-collapse:collapse;font-size:11.5px">'+
          '<thead><tr>'+['#','البند','نعم / لا','ملاحظة'].map(function(h,i){ return '<th style="background:var(--surface-2);padding:8px 12px;font-size:11px;font-weight:600;color:var(--text-2);text-align:'+(i===0?'center':'right')+';'+(i===0?'width:34px':(i===2?'width:110px':(i===3?'width:190px':'')))+'">'+h+'</th>'; }).join('')+'</tr></thead><tbody>'+
          ENG_ITEMS.map(function(item,i){ var row=d.checklist[i];
            return '<tr><td style="border-bottom:1px solid var(--border);padding:8px 12px;text-align:center;color:var(--text-3)">'+(i+1)+'</td>'+
              '<td style="border-bottom:1px solid var(--border);padding:8px 12px;line-height:1.6;color:var(--text)">'+item+'</td>'+
              '<td style="border-bottom:1px solid var(--border);padding:8px 12px"><div style="display:flex;justify-content:center;gap:12px">'+
                ['yes','no'].map(function(v){ return '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:11.5px"><input type="radio" name="engq'+i+'" data-eng-q="'+i+'" value="'+v+'" '+(row.a===v?'checked':'')+' style="accent-color:var(--gold-d)">'+(v==='yes'?'نعم':'لا')+'</label>'; }).join('')+'</div></td>'+
              '<td style="border-bottom:1px solid var(--border);padding:8px 12px"><textarea data-eng-qn="'+i+'" rows="1" style="'+INP_STYLE+';width:100%;min-height:34px;resize:vertical;font-size:11.5px">'+esc(row.note)+'</textarea></td></tr>';
          }).join('')+'</tbody></table></div>'+errLine('checklist')+
        (ro?'':'<div style="margin-top:18px;display:flex;justify-content:flex-start"><button class="primary" data-eng-submit style="padding:9px 22px;font-size:13px">إرسال الرفع المساحي</button></div>');
    } else if(ENGS.tab==='fees'){
      body=engSection('أتعاب الرفع المساحي')+
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+engField('قيمة الأتعاب','٨٬٥٠٠ ر.س')+engField('حالة الاستحقاق',d.status==='submitted'?pill('مستحقة بعد الإرسال',GREEN):pill('تُستحق عند إرسال الرفع',AMBER))+engField('حالة الدفع',pill('لم تُصرف',GRAY))+'</div>'+
        engInfo('تُستحق أتعاب الرفع المساحي للمكتب الهندسي عند إرسال المعاملة واعتمادها من أخصائي دراسة الحالة.');
    } else if(ENGS.tab==='notes'){
      body=engSection('ملاحظة على المعاملة')+
        '<textarea id="engNote" rows="5" '+(ro?'disabled':'')+' placeholder="اكتب ملاحظتك هنا…" style="'+INP_STYLE+';width:100%;min-height:120px;resize:vertical">'+esc(d.note)+'</textarea>'+
        (ro?'<p style="margin-top:8px;font-size:11px;color:var(--text-3)">'+(viewOnly?'وضع الاستعراض — لا يمكن التعديل.':'لا يمكن تعديل الملاحظة بعد إرسال المعاملة أو إغلاقها.')+'</p>'
          :'<div style="margin-top:12px"><button class="primary" data-eng-savenote style="padding:7px 18px;font-size:12px">حفظ الملاحظة</button></div>');
    } else if(ENGS.tab==='failures'){
      body=engSection('تسجيل تعذر')+
        (ro?engInfo(viewOnly?'وضع الاستعراض — لا يمكن تسجيل تعذر من هنا.':'لا يمكن تسجيل تعذر بعد إرسال المعاملة.','amber')
          :'<div style="display:grid;gap:10px;max-width:560px"><div><label class="tf-lbl">وصف التعذر *</label><textarea id="engFailText" rows="3" placeholder="صف التعذر الميداني…" style="'+INP_STYLE+';width:100%;resize:vertical"></textarea></div><div><button class="primary" data-eng-fail style="padding:7px 18px;font-size:12px">رفع التعذر</button></div></div>')+
        engSection('سجل التعذرات')+
        ((d.failures&&d.failures.length)?'<div style="display:grid;gap:8px">'+d.failures.map(function(f){ return '<div style="'+ENG_BOX+';display:flex;justify-content:space-between;gap:10px"><span style="font-size:12px">'+esc(f.text)+'</span>'+pill('مفتوح',RED)+'</div>'; }).join('')+'</div>'
          :'<div style="font-size:12px;color:var(--text-3)">لا توجد تعذرات مسجلة على هذا العقار.</div>');
    }
    var fabDim=locked;
    document.getElementById('view-engSurvey').innerHTML=
      '<button class="back-link" data-eng-back="1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg> العودة إلى الرفع المساحي</button>'+
      '<div class="pp-head" style="margin-bottom:14px"><h1 class="pp-title"><span>مساحة عمل الرفع المساحي</span><span class="pp-po">صك '+esc(ENGS.deed)+'</span></h1>'+
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px"><span class="chip">'+esc(ENGS.office||'المكتب الهندسي')+'</span>'+(ENGS.done?pill('مكتمل',GREEN):locked?pill('مُرسل',GREEN):d.status==='reopened'?pill('مُعاد للتصحيح',AMBER):pill('مسودة',GOLD))+(viewOnly?pill('استعراض',GRAY):'')+'</div></div>'+
      '<div class="card" style="padding:18px 20px">'+tabBar+
        (ENGS.gate?'<div style="background:#fef3d7;border:1px solid #fad7a0;color:#7a5b12;border-radius:8px;padding:9px 12px;font-size:11.5px;line-height:1.7;margin-bottom:14px"><strong>⚠ الرفع مجمّد ولا يُحتسب الوقت:</strong> '+esc(ENGS.gateReason||'لا تتحقق اشتراطات البدء بالرفع المساحي.')+'</div>':'')+
        (viewOnly&&!ENGS.gate?'<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#fef3d7;border:1px solid #fad7a0;color:#7a5b12;border-radius:8px;padding:9px 12px;font-size:11.5px;line-height:1.7;margin-bottom:14px"><span>👁 وضع الاستعراض — جميع الحقول للقراءة فقط.'+(locked?'':' للتعديل ابدأ عملية الرفع.')+'</span>'+(locked?'':'<button class="primary" data-eng-startedit style="padding:6px 14px;font-size:11.5px">بدء الرفع المساحي</button>')+'</div>':'')+
        '<div style="'+(ro&&ENGS.tab!=='property'&&ENGS.tab!=='fees'?'opacity:.75;pointer-events:none;user-select:none':'')+(locked&&ENGS.tab==='survey'?';filter:grayscale(.35);background:#F1F5F9;border-radius:10px;padding:12px':'')+'">'+body+'</div></div>'+
      '<div style="position:fixed;bottom:26px;left:26px;z-index:200">'+
        '<div id="engFabMenu" hidden style="position:absolute;bottom:calc(100% + 12px);left:0;width:240px;background:var(--surface);border:1px solid var(--border-2);border-radius:12px;padding:6px;box-shadow:0 10px 30px rgba(15,42,78,.18)">'+
          [['start','ابدأ الرفع المساحي',fabDim],['fail','إضافة تعذر',fabDim],['note','إضافة ملاحظة',fabDim],['recall','طلب استرجاع المعاملة',!fabDim]].map(function(a){
            return '<button data-eng-fab="'+a[0]+'" style="display:flex;width:100%;align-items:center;gap:10px;border:none;background:none;border-radius:8px;padding:8px 10px;font-family:inherit;font-size:12.5px;cursor:pointer;text-align:right;color:var(--text);'+(a[2]?'opacity:.45':'')+'" onmouseover="this.style.background=\'var(--surface-2)\'" onmouseout="this.style.background=\'none\'">'+a[1]+'</button>'; }).join('')+'</div>'+
        '<button id="engFabBtn" aria-label="إجراءات سريعة" style="width:54px;height:54px;border-radius:50%;border:none;background:var(--ink);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(15,42,78,.35)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></button></div>';
    setHeader('المكتب الهندسي — الرفع المساحي', crumb(['لوحة التحكم','الرفع المساحي','مساحة العمل']));
    navActive('الرفع المساحي'); showView('engSurvey');
  }
  document.addEventListener('click', function(e){
    var bk=e.target.closest('[data-eng-blocked]');
    if(bk){ document.querySelectorAll('.actions.open').forEach(function(x){ x.classList.remove('open'); }); showToast('لا يمكن بدء الرفع المساحي — '+bk.getAttribute('data-eng-blocked')); return; }
    var fno=e.target.closest('[data-fn-open]');
    if(fno){ var r=fno.getAttribute('data-fn-open'); FEE_STATE.openFn=(FEE_STATE.openFn===r?'':r); renderEngFees(); return; }
    var fap=e.target.closest('[data-fee-approve]');
    if(fap){ var ff=ENG_FEES[+fap.getAttribute('data-fee-approve')]; if(ff){ ff.st='ready'; renderEngFees(); showToast('شكراً لكم — تم قبول التعديل وأصبح البند جاهزاً للفوترة.'); } return; }
    var fob=e.target.closest('[data-fee-object]');
    if(fob){ var bx=document.getElementById('feeObj'+fob.getAttribute('data-fee-object')); if(bx){ bx.hidden=!bx.hidden; if(!bx.hidden){ var tx0=bx.querySelector('textarea'); if(tx0) tx0.focus(); } } return; }
    var foc=e.target.closest('[data-fee-objconfirm]');
    if(foc){ var i2=+foc.getAttribute('data-fee-objconfirm'); var ta=document.getElementById('feeObjTxt'+i2); var txt=(ta?ta.value:'').trim();
      if(!txt){ if(ta){ ta.style.borderColor='#c0553d'; ta.focus(); } return; }
      ENG_FEES[i2].st='dispute'; ENG_FEES[i2].objection=txt; renderEngFees(); showToast('تم تسجيل تحفّظكم — سيتواصل معكم المشرف لمعالجته والوصول إلى تسوية مرضية.'); return; }
    var ap=e.target.closest('[data-eng-approve]');
    if(ap){ document.querySelectorAll('.actions.open').forEach(function(x){ x.classList.remove('open'); }); var ao=ENG_ORDERS.find(function(x){ return x.deed===ap.getAttribute('data-eng-approve'); }); if(ao){ ao.approved=true; renderEngOrders(); showToast('اعتمد أخصائي دراسة الحالة الرفع المساحي — أصبحت المعاملة جاهزة للفوترة.'); } return; }
    var nf=e.target.closest('[data-eng-notify]');
    if(nf){ document.querySelectorAll('.actions.open').forEach(function(x){ x.classList.remove('open'); }); var od=ENG_ORDERS.find(function(x){ return x.deed===nf.getAttribute('data-eng-notify'); });
      if(od){ od.suspendReqAt=Date.now(); renderEngOrders(); showToast('أُشعر أخصائي دراسة الحالة بطلب التعليق — تُعلّق المعاملة بموافقته، أو تلقائياً بعد نصف ساعة بلا رد (ضمن ساعات العمل).'); } return; }
    var op=e.target.closest('[data-open-eng]');
    if(op && !e.target.closest('.kebab')){ document.querySelectorAll('.actions.open').forEach(function(x){ x.classList.remove('open'); }); renderEngSurvey(op.getAttribute('data-open-eng'), op.getAttribute('data-eng-t')||'survey', op.getAttribute('data-eng-m')||'work', op.getAttribute('data-eng-done')==='1', op.getAttribute('data-eng-deed'), op.getAttribute('data-eng-po'), op.getAttribute('data-eng-gate')==='1', op.getAttribute('data-eng-gr')||''); return; }
    var ev=document.getElementById('view-engSurvey'); if(!ev||ev.hidden) return;
    if(e.target.closest('[data-eng-back]')){ renderEngOrders(); return; }
    var tb=e.target.closest('[data-eng-tab]');
    if(tb){ ENGS.tab=tb.getAttribute('data-eng-tab'); ENGS.err=null; renderEngSurvey(); return; }
    if(ENGS.mode==='view'&&(e.target.closest('[data-eng-f]')||e.target.closest('[data-eng-q]')||e.target.closest('[data-eng-qn]')||e.target.closest('[data-eng-confirm]')||e.target.closest('[data-eng-pick]')||e.target.closest('[data-eng-submit]'))){ e.preventDefault(); showToast('وضع الاستعراض — ابدأ الرفع المساحي للتعديل'); return; }
    if(e.target.closest('#engFabBtn')){ var m=document.getElementById('engFabMenu'); m.hidden=!m.hidden; return; }
    var fa=e.target.closest('[data-eng-fab]');
    if(fa){ document.getElementById('engFabMenu').hidden=true; var k=fa.getAttribute('data-eng-fab'); var lk=ENGS.draft.status==='submitted'||ENGS.done;
      if(k==='start'&&ENGS.gate){ showToast('لا يمكن بدء الرفع المساحي — '+(ENGS.gateReason||'لا تتحقق اشتراطات البدء.')); return; }
      if(k==='start'){ if(lk){ showToast('تم إرسال الرفع المساحي — استخدم «طلب استرجاع المعاملة» لإعادة فتح العمل.'); } else { ENGS.mode='work'; ENGS.tab='survey'; renderEngSurvey(); } return; }
      if(k==='fail'){ if(lk){ showToast('لا يمكن تسجيل تعذر بعد إرسال المعاملة.'); } else { ENGS.mode='work'; ENGS.tab='failures'; renderEngSurvey(); } return; }
      if(k==='note'){ if(lk){ showToast('لا يمكن إضافة ملاحظة بعد إرسال المعاملة.'); } else { ENGS.mode='work'; ENGS.tab='notes'; renderEngSurvey(); } return; }
      if(k==='recall'){ if(!lk){ showToast('لا يمكن طلب الاسترجاع قبل إرسال الرفع المساحي'); } else { ENGS.draft.status='reopened'; ENGS.draft.returnNote='أُعيد فتح المعاملة بناءً على طلب الاسترجاع.'; engSave(); ENGS.tab='survey'; renderEngSurvey(); showToast('تم طلب استرجاع المعاملة — أُعيد فتح الرفع المساحي.'); } return; } }
    if(e.target.closest('[data-eng-startedit]')){ ENGS.mode='work'; ENGS.tab='survey'; renderEngSurvey(); showToast('بدأت عملية الرفع المساحي — الحقول قابلة للتعديل.'); return; }
    var pk=e.target.closest('[data-eng-pick]');
    if(pk){ var key=pk.getAttribute('data-eng-pick'); var inp=document.createElement('input'); inp.type='file'; inp.accept='.pdf,application/pdf';
      inp.onchange=function(){ if(inp.files[0]){ ENGS.draft[key]=inp.files[0].name; delete ENGS.fieldErr[key]; engSave(); renderEngSurvey(); } }; inp.click(); return; }
    var cl=e.target.closest('[data-eng-clear]');
    if(cl){ ENGS.draft[cl.getAttribute('data-eng-clear')]=''; engSave(); renderEngSurvey(); return; }
    if(e.target.closest('[data-eng-savenote]')){ var nt=document.getElementById('engNote'); ENGS.draft.note=nt?nt.value:''; engSave(); showToast('تم حفظ الملاحظة'); renderEngSurvey(); return; }
    if(e.target.closest('[data-eng-fail]')){ var ft=document.getElementById('engFailText'); var tx=(ft?ft.value:'').trim();
      if(!tx){ if(ft){ ft.style.borderColor='#c0553d'; ft.focus(); } return; }
      ENGS.draft.failures=ENGS.draft.failures||[]; ENGS.draft.failures.push({text:tx}); engSave(); showToast('تم رفع التعذر — سيظهر لأخصائي دراسة الحالة.'); renderEngSurvey(); return; }
    if(e.target.closest('[data-eng-submit]')){
      var d=ENGS.draft, fe={};
      if(!d.lat.trim()||isNaN(Number(d.lat))) fe.lat='أدخل خط العرض بصيغة رقمية صحيحة';
      if(!d.lng.trim()||isNaN(Number(d.lng))) fe.lng='أدخل خط الطول بصيغة رقمية صحيحة';
      if(!d.report) fe.report='ارفع التقرير المساحي (PDF)';
      if(!d.letter) fe.letter='ارفع خطاب إقرار صحة الموقع';
      if(!d.confirmed) fe.confirmed='يجب الإقرار بصحة البيانات المساحية';
      if(d.checklist.some(function(r){ return r.a===null; })) fe.checklist='أكمل جميع بنود نموذج التحقق الميداني (13 بنداً)';
      ENGS.fieldErr=fe;
      if(Object.keys(fe).length){ ENGS.err=fe.lat||fe.lng||fe.report||fe.letter||fe.confirmed||fe.checklist; renderEngSurvey(); showToast(ENGS.err); return; }
      d.status='submitted'; delete d.returnNote; ENGS.err=null; engSave(); renderEngSurvey(); showToast('تم إرسال الرفع المساحي بنجاح.'); return; }
  });
  document.addEventListener('input', function(e){
    var v=document.getElementById('view-engSurvey'); if(!v||v.hidden||!ENGS.draft) return;
    var f=e.target.closest('[data-eng-f]'); if(f){ ENGS.draft[f.getAttribute('data-eng-f')]=f.value; delete ENGS.fieldErr[f.getAttribute('data-eng-f')]; engSave(); return; }
    var qn=e.target.closest('[data-eng-qn]'); if(qn){ ENGS.draft.checklist[+qn.getAttribute('data-eng-qn')].note=qn.value; engSave(); return; }
  });
  document.addEventListener('change', function(e){
    var v=document.getElementById('view-engSurvey'); if(!v||v.hidden||!ENGS.draft) return;
    var q=e.target.closest('[data-eng-q]'); if(q){ ENGS.draft.checklist[+q.getAttribute('data-eng-q')].a=q.value; delete ENGS.fieldErr.checklist; engSave(); return; }
    if(e.target.closest('[data-eng-confirm]')){ ENGS.draft.confirmed=e.target.checked; delete ENGS.fieldErr.confirmed; engSave(); return; }
  });

