function openKeyRegister(prefill){
    if(prefill && !prefill.request) prefill=null;
    keyCloseModal();
    var body=
      '<div class="form-grid">'+
        '<div class="fld full" data-f="request"><label>رقم الطلب *</label><div style="position:relative"><input id="kf_request" placeholder="اكتب للبحث في طلبات المعاملات المفتوحة..." autocomplete="off" style="width:100%" /><div id="kf_reqList" hidden style="position:absolute;top:calc(100% + 4px);inset-inline:0;z-index:30;background:var(--surface);border:1px solid var(--border-2);border-radius:10px;box-shadow:0 12px 30px -8px rgba(18,40,76,.3);max-height:220px;overflow-y:auto;padding:4px"></div></div><span class="msg"></span></div>'+
        '<div class="fld full"><label>مصدر استلام الظرف *</label><div id="kf_srcRow" style="display:flex;gap:8px">'+
          '<button type="button" data-ksrc="court" style="flex:1;height:38px;border-radius:10px;border:1.5px solid var(--border-2);background:var(--surface-2);color:var(--text-2);font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:all .15s">المحكمة</button>'+
          '<button type="button" data-ksrc="party" style="flex:1;height:38px;border-radius:10px;border:1.5px solid var(--border-2);background:var(--surface-2);color:var(--text-2);font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:all .15s">طرف آخر</button>'+
        '</div></div>'+
        '<div class="fld full" data-f="party" id="kf_partyFld" style="display:none"><label>بيانات الطرف المسلِّم *</label>'+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
            '<input id="kf_party" placeholder="الاسم * — مثال: محمد أحمد حسن" />'+
            '<input id="kf_partyOrg" placeholder="الجهة التي يمثلها — مثال: شركة أبعاد للتقييم" />'+
            '<input id="kf_partyRole" placeholder="الصفة — مثال: وكيل بيع" />'+
            '<input id="kf_partyPhone" dir="ltr" placeholder="* 05xxxxxxxx" />'+
          '</div><span class="msg"></span></div>'+
        '<div class="fld"><label>المحكمة</label><input id="kf_court" placeholder="محكمة التنفيذ ب..." /></div>'+
        '<div class="fld"><label>الدائرة</label><input id="kf_circuit" placeholder="الدائرة ..." /></div>'+
        '<div class="fld" data-f="actual"><label>عدد المفاتيح *</label><input id="kf_count" type="number" min="1" value="1" /><span class="msg"></span></div>'+
        '<div class="fld full"><label>صورة الظرف — اضغط الخانة للالتقاط بالكاميرا أو اسحب الملف إليها</label>'+
          '<div style="display:grid;grid-template-columns:1fr;gap:10px">'+
            '<div id="kf_slot_photo" data-kslot="photo" style="border:1.5px dashed var(--border-2);border-radius:12px;padding:14px 12px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s"></div>'+
          '</div>'+
          '<input type="file" id="kf_in_photo" accept="image/*" capture="environment" hidden />'+
        '</div>'+
        '<div class="fld full"><label>ملاحظات</label><textarea id="kf_notes" rows="2" placeholder="اختياري"></textarea></div>'+
      '</div>'+
      '<div id="kf_fee" style="display:flex;align-items:flex-start;gap:9px;margin-top:12px;padding:10px 14px;border-radius:10px;font-size:12.5px;font-weight:600;line-height:1.7"></div>';
    var ov=keyModalShell('تسجيل ظرف مفاتيح', body, 'تسجيل الظرف');
    var state={ scen:'court', slots:{photo:null} };
    function drawSrc(){
      ov.querySelectorAll('[data-ksrc]').forEach(function(b){ var on=b.getAttribute('data-ksrc')===state.scen;
        b.style.borderColor=on?'var(--gold)':'var(--border-2)'; b.style.background=on?'var(--gold-soft)':'var(--surface-2)'; b.style.color=on?'var(--gold-d)':'var(--text-2)'; });
      document.getElementById('kf_partyFld').style.display=state.scen==='party'?'':'none';
    }
    ov.querySelectorAll('[data-ksrc]').forEach(function(b){ b.addEventListener('click',function(){ state.scen=b.getAttribute('data-ksrc'); drawSrc(); }); });
    drawSrc();
    var SLOT={ photo:{label:'صورة الظرف', hint:'التقط الظرف وعليه رقم الطلب', icon:'<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.2"/><path d="M8 6l1.5-2h5L16 6"/>'} };
    function updateFee(){
      var box=document.getElementById('kf_fee'); var ok=!!state.slots.photo;
      box.style.background=ok?'color-mix(in srgb,#3f8f5f 12%,transparent)':'color-mix(in srgb,#d9a441 14%,transparent)';
      box.style.color=ok?'#2f7a4d':'#8a5e14';
      box.innerHTML='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px">'+(ok?'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>':'<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')+'</svg><span>'+(ok?'تم إثبات أتعاب استلام المفاتيح — صورة الظرف توثّق استحقاق الشركة لدى مركز الإسناد والتصفية.':'صورة الظرف هي إثبات أتعاب استلام المفاتيح التي تستحقها الشركة من مركز الإسناد والتصفية. أتعاب الزيارة نفسها تُستحق عبر إسناد مهمة زيارة المحكمة.')+'</span>';
    }
    function drawSlots(){
      ['photo'].forEach(function(k){
        var el=document.getElementById('kf_slot_'+k), m=SLOT[k], f=state.slots[k];
        el.style.borderColor=f?'#3f8f5f':'var(--border-2)';
        el.style.background=f?'color-mix(in srgb,#3f8f5f 7%,transparent)':'';
        el.innerHTML= f
          ? '<div style="display:flex;align-items:center;gap:8px;justify-content:center;color:#2f7a4d"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span style="font-size:12.5px;font-weight:700;color:var(--heading)">'+esc(m.label)+'</span></div><div style="font-size:11px;color:var(--text-2);margin-top:5px;direction:ltr;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(f)+'</div><div style="display:flex;gap:12px;justify-content:center;margin-top:8px"><span style="font-size:11px;color:var(--gold-d);font-weight:700;cursor:pointer">استبدال</span><span data-krm="'+k+'" style="font-size:11px;color:#d9694f;font-weight:700;cursor:pointer">حذف</span></div>'
          : '<div style="display:grid;place-items:center;gap:6px;color:var(--text-3)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+m.icon+'</svg><span style="font-size:12.5px;font-weight:700;color:var(--heading)">'+esc(m.label)+' *</span><span style="font-size:11px">'+esc(m.hint)+'</span></div>';
      });
      updateFee();
    }
    ['photo'].forEach(function(k){
      var el=document.getElementById('kf_slot_'+k), fin2=document.getElementById('kf_in_'+k);
      el.addEventListener('click',function(ev){
        var rm=ev.target.closest('[data-krm]');
        if(rm){ state.slots[rm.getAttribute('data-krm')]=null; drawSlots(); return; }
        fin2.click();
      });
      fin2.addEventListener('change',function(){ if(fin2.files[0]) state.slots[k]=fin2.files[0].name; fin2.value=''; drawSlots(); });
      el.addEventListener('dragover',function(ev){ ev.preventDefault(); el.style.borderColor='var(--gold)'; el.style.background='var(--gold-soft)'; });
      el.addEventListener('dragleave',function(){ drawSlots(); });
      el.addEventListener('drop',function(ev){ ev.preventDefault(); if(ev.dataTransfer.files[0]) state.slots[k]=ev.dataTransfer.files[0].name; drawSlots(); });
    });
    drawSlots();
    state.pickedProp=null;
    function openReqs(){
      var used={}; KEY_ENV.forEach(function(x){ used[x.request]=1; });
      var out=[], seen={};
      ORDERS.forEach(function(o){ if(TERMINAL[o.status]) return; genProps(o).forEach(function(p){ if(p.registered&&p.request&&!used[p.request]){ if(!seen[p.request]){ seen[p.request]={request:p.request,court:p.court,circuit:p.circuit,deeds:[],p:p,o:o}; out.push(seen[p.request]); } seen[p.request].deeds.push(p.deed); } }); });
      return out;
    }
    function drawReqList(){
      var box=document.getElementById('kf_reqList');
      var q=document.getElementById('kf_request').value.trim();
      var list=openReqs().filter(function(r){ return !q || r.request.indexOf(q)>=0; }).slice(0,12);
      if(!list.length){ box.hidden=true; return; }
      box.innerHTML=list.map(function(r,i){ return '<div data-req-i="'+i+'" style="display:flex;align-items:center;gap:10px;padding:8px 11px;border-radius:8px;cursor:pointer" onmouseover="this.style.background=\'var(--row-hover)\'" onmouseout="this.style.background=\'\'"><span style="font-weight:700;color:var(--gold-d);font-size:13px">'+esc(r.request)+'</span><span style="font-size:11.5px;color:var(--text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.court+' · '+(r.deeds.length>1?r.deeds.length+' صكوك':'صك '+r.deeds[0]))+'</span></div>'; }).join('');
      box.hidden=false;
      box.querySelectorAll('[data-req-i]').forEach(function(it){ it.addEventListener('mousedown',function(ev){ ev.preventDefault();
        var r=list[+it.getAttribute('data-req-i')];
        document.getElementById('kf_request').value=r.request;
        document.getElementById('kf_court').value=r.court;
        document.getElementById('kf_circuit').value=r.circuit;
        state.pickedProp=r; box.hidden=true;
      }); });
    }
    var reqIn=document.getElementById('kf_request');
    reqIn.addEventListener('input',function(){ state.pickedProp=null; drawReqList(); });
    reqIn.addEventListener('focus',drawReqList);
    reqIn.addEventListener('blur',function(){ setTimeout(function(){ var b=document.getElementById('kf_reqList'); if(b) b.hidden=true; },150); });
    if(prefill){ document.getElementById('kf_request').value=prefill.request||''; document.getElementById('kf_court').value=prefill.court||''; document.getElementById('kf_circuit').value=prefill.circuit||''; }
    document.getElementById('keySaveBtn').addEventListener('click',function(){
      var request=document.getElementById('kf_request').value.trim();
      var court=document.getElementById('kf_court').value.trim();
      var circuit=document.getElementById('kf_circuit').value.trim();
      var notes=document.getElementById('kf_notes').value.trim();
      var actual=+document.getElementById('kf_count').value||0;
      var labeled=actual;
      if(!request){ keyErr('رقم طلب إنفاذ مطلوب.'); document.getElementById('kf_request').focus(); return; }
      if(KEY_ENV.some(function(x){ return x.request.toLowerCase()===request.toLowerCase(); })){ keyErr('رقم الطلب مسجّل مسبقاً.'); return; }
      var party=(document.getElementById('kf_party').value||'').trim();
      var partyOrg=(document.getElementById('kf_partyOrg').value||'').trim();
      var partyRole=(document.getElementById('kf_partyRole').value||'').trim();
      var partyPhone=(document.getElementById('kf_partyPhone').value||'').trim();
      if(state.scen==='party'&&!party){ keyErr('يلزم إدخال اسم الطرف المسلِّم.'); return; }
      if(state.scen==='party'&&!partyPhone){ keyErr('يلزم إدخال رقم جوال الطرف المسلِّم.'); return; }
      var partyFull=state.scen==='party'?party+(partyOrg?' — ممثل '+partyOrg:'')+(partyRole?' بصفتها '+partyRole:'')+(partyPhone?' — '+partyPhone:''):'';
      if(actual<1){ keyErr('عدد المفاتيح يجب أن يكون ١ على الأقل.'); return; }
      var t=keyToday(), amt=350, fee=!!state.slots.photo;
      var env={ id:'e'+Date.now(), request:request, court:court||'—', circuit:circuit||'—', labeled:labeled, actual:actual,
        scenario:state.scen, sourceParty:partyFull, status:'reviewer', fee:fee, feeAmount:fee?amt:0, created:t.date,
        contact:'', _user:true, receivedBy:'أحمد الشمري', ref:'ENV-2026-'+('000'+(KEY_ENV.length+1)).slice(-3),
        attachments:['photo'].filter(function(k){return state.slots[k];}).map(function(k){ return {k:k, label:state.slots[k]}; }), assignments:[], handoffs:[], timeline:[] };
      var scenTxt=state.scen==='court'?'استلام من المحكمة':'استلام من طرف آخر ('+(env.sourceParty||'')+')';
      env.timeline.push({ev:'created',date:t.dt,detail:'تسجيل الظرف برقم الطلب '+request+' — '+scenTxt+' — الحالة: بعهدة المراجع'});
      if(fee) env.timeline.push({ev:'fee',date:t.dt,detail:'تسجيل حالة مالية — وجوب رفع أتعاب استلام المفاتيح ('+amt+' ر.س) على إنفاذ — الإثبات: صورة الظرف، والتحصيل بتأكيد المالية بعد اكتمال الدراسة'});
      else env.timeline.push({ev:'note',date:t.dt,detail:'لم يُثبت استحقاق أتعاب استلام المفاتيح — صورة الظرف غير مرفقة'});
      if(notes) env.timeline.push({ev:'note',date:t.dt,detail:'ملاحظة: '+notes});
      KEY_ENV.unshift(env);
      keyPersist();
      var linkedDeeds={};
      ORDERS.forEach(function(o){ if(TERMINAL[o.status]) return; genProps(o).forEach(function(p){ if(p.registered&&p.request===request&&!linkedDeeds[p.deed]){ linkedDeeds[p.deed]=1; p._env=env;
        var doneBefore = priorWork(p.deed,o.po).some(function(w){return w.done;});
        env.assignments.push({deed:p.deed, property:(p.city?p.city+' · '+p.district:'العقار'), po:o.po, status:doneBefore?'matched':'pending', confirmedBy:doneBefore?'أمر عمل سابق':'', note:doneBefore?'صك منجز ومسلَّم سابقاً — المفتاح مؤكد':'ربط تلقائي برقم الطلب'});
        env.timeline.push({ev:'assign',date:t.dt,detail:doneBefore?('ربط الصك '+p.deed+' — منجز ومسلَّم سابقاً، المفتاح مؤكد دون تجربة ميدانية'):('ربط تلقائي للصك '+p.deed+' — رقم الطلب مسجَّل مسبقاً في بيانات المعاملة')}); } }); });
      keyPersist();
      keyCloseModal();
      if(prefill&&prefill.stay==='gov'){ renderGovReview(); showToast('تم تسجيل الظرف '+request+' وربطه بالعقار'+(fee?' وتوليد بند الأتعاب.':'.')); return; }
      renderKeyDetail(env.id);
      showToast('تم تسجيل الظرف '+request+(fee?' وتوليد بند الأتعاب.':'.'));
    });
  }
