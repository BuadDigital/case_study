function openKeyHandoff(env){
    keyCloseModal();
    var deliver=env.status==='reviewer';
    if(!deliver){
      var holder=(env.handoffs.length?env.handoffs[env.handoffs.length-1].person:'')||'الطرف الحالي';
      var body2='<div style="display:flex;gap:13px;align-items:flex-start"><span style="flex-shrink:0;width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,#378add 14%,transparent);color:#378add"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><div><div style="font-size:14px;font-weight:800;color:var(--heading);margin-bottom:5px">تأكيد استلام الظرف '+esc(env.request)+'</div><div style="font-size:12.5px;color:var(--text-2);line-height:1.7">الظرف بعهدة <b>'+esc(holder)+'</b> — أنت معرَّف في النظام (المراجع الحكومي)، يكفي تأكيد الاستلام لتعود العهدة إليك ويوثَّق ذلك في السجل.</div></div></div>';
      keyModalShell('استلام الظرف — '+env.request, body2, 'تأكيد الاستلام');
      document.getElementById('keySaveBtn').addEventListener('click',function(){
        var t=keyToday();
        env.handoffs.push({type:'receive_back', state:'completed', person:'أحمد الشمري', role:'مراجع حكومي', date:t.date, letter:''});
        env.status='reviewer';
        env.timeline.push({ev:'handoff',date:t.dt,detail:'تأكيد استلام الظرف من '+holder+' — عادت العهدة للمراجع (مستخدم معرَّف بالنظام)'});
        keyPersist(); keyCloseModal(); renderKeyDetail(env.id); showToast('تم تأكيد استلام الظرف '+env.request+'.');
      });
      return;
    }
    var opts='<option value="internal">تسليم داخلي (مستخدم في النظام)</option><option value="external">تسليم لجهة خارجية</option><option value="return_court">إرجاع للمحكمة</option>';
    var body='<div class="form-grid">'+
      '<div class="fld full"><label>'+(deliver?'تسليم إلى':'الإجراء')+'</label><div class="sel" style="width:100%"><select id="kh_type" style="width:100%">'+opts+'</select><span class="caret"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></div></div>'+
      '<div class="fld full" data-f="person" id="kh_personSelFld"><label>مستخدم معرَّف في النظام *</label><div class="sel" style="width:100%"><select id="kh_personSel" style="width:100%"><option value="">— اختر المستخدم —</option><option>سعد القحطاني</option><option>فهد العتيبي</option><option>ماجد الحربي</option><option>عبدالله الزهراني</option></select><span class="caret"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></div><span class="msg"></span></div>'+
      '<div class="fld full" data-f="person" id="kh_personTxtFld" hidden><label id="kh_pLbl">بيانات الطرف الخارجي *</label>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
          '<input id="kh_person" placeholder="الاسم * — مثال: محمد أحمد حسن" />'+
          '<input id="kh_org" placeholder="الجهة — مثال: شركة أبعاد للتقييم" />'+
          '<input id="kh_role" placeholder="الصفة — مثال: وكيل بيع" />'+
          '<input id="kh_phone" dir="ltr" placeholder="* 05xxxxxxxx" />'+
        '</div><span class="msg"></span></div>'+
      '<div class="fld full" id="kh_courtFld" style="display:none"><label>جهة المحكمة (من بيانات تسجيل الظرف)</label><div style="display:flex;align-items:center;gap:10px;min-height:44px;padding:10px 14px;border-radius:10px;border:1.5px solid var(--border-2);background:var(--surface-2)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold-d)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg><span style="font-size:13px;font-weight:700;color:var(--heading)">'+esc(env.court)+'</span><span style="font-size:11.5px;color:var(--text-3)">'+esc(env.circuit)+'</span></div></div>'+
      '<div class="fld full" id="kh_proofFld" hidden><label>إثبات تسليم المفتاح *</label>'+
        '<div style="display:grid;gap:8px">'+
          '<button type="button" id="kh_proofCam" style="display:flex;align-items:center;gap:12px;min-height:52px;padding:10px 14px;border-radius:12px;border:1.5px dashed var(--border-2);background:var(--surface-2);cursor:pointer;text-align:start;font-family:inherit"><span style="flex-shrink:0;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:color-mix(in srgb,#378add 12%,transparent);color:#378add"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg></span><span><span id="kh_proofCamTxt" style="display:block;font-size:13px;font-weight:800;color:var(--heading)">تصوير بالهاتف أو رفع مستند</span><span style="display:block;font-size:11.5px;color:var(--text-3);margin-top:1px">محضر تسليم، إيصال، أو صورة أثناء التسليم</span></span></button>'+
          '<button type="button" id="kh_proofSys" style="display:flex;align-items:center;gap:12px;min-height:52px;padding:10px 14px;border-radius:12px;border:1.5px solid var(--border-2);background:var(--surface-2);cursor:pointer;text-align:start;font-family:inherit"><span data-dot style="flex-shrink:0;width:14px;height:14px;border-radius:99px;border:2px solid #2f7a4d;background:transparent"></span><span><span style="display:block;font-size:13px;font-weight:800;color:#2f7a4d">إقرار عبر النظام</span><span style="display:block;font-size:11.5px;color:var(--text-3);margin-top:1px">تُرسل دعوة تأكيد للجهة — يبقى التسليم «بانتظار الإقرار» حتى تؤكد</span></span></button>'+
        '</div>'+
        '<input type="file" id="kh_proofFile" accept="image/*,application/pdf" capture="environment" hidden /><span class="msg"></span></div>'+
      '<div class="fld full"><div class="tf-note" id="kh_note">التسليم الداخلي يُسجَّل بحالة «بانتظار التأكيد» ثم يؤكّده المعاين — وتنتقل العهدة إليه.</div></div>'+
    '</div>';
    keyModalShell((deliver?'تسليم الظرف — ':'استلام الظرف — ')+env.request, body, deliver?'تسليم':'استلام');
    var META={ internal:{lbl:'اسم المعاين *',role:'معاين ميداني',letter:false,note:'التسليم الداخلي يُسجَّل بحالة «بانتظار التأكيد» ثم يؤكّده المعاين — وتنتقل العهدة إليه.',status:'assessor',state:'pending_confirm'},
      external:{lbl:'اسم الجهة الخارجية *',role:'جهة خارجية',letter:false,note:'التسليم الخارجي يتطلب إثباتاً: صورة/مستند، أو إقراراً من الجهة عبر النظام.',status:'external',state:'confirmed'},
      receive_back:{lbl:'المستلِم (المراجع) *',role:'مراجع حكومي',letter:true,note:'استلام الظرف ممن هو بعهدته الآن — تعود العهدة إليك (المراجع).',status:'reviewer',state:'completed'},
      return_court:{lbl:'جهة المحكمة *',role:'المحكمة',letter:false,note:'المحكمة جهة معرَّفة — لا يلزم إثبات استلام؛ الإرجاع يُنهي دورة الظرف.',status:'returned',state:'completed'} };
    function sync(){ var ty=document.getElementById('kh_type').value, m=META[ty];
      document.getElementById('kh_pLbl').textContent=m.lbl;
      document.getElementById('kh_note').textContent=m.note;
      document.getElementById('kh_proofFld').style.display=ty==='external'?'':'none';
      document.getElementById('kh_personSelFld').style.display=ty==='internal'?'':'none';
      document.getElementById('kh_personTxtFld').style.display=ty==='external'?'':'none';
      if(ty==='return_court'){ var p=document.getElementById('kh_person'); p.value=env.court||''; }
      else if(document.getElementById('kh_person').value===env.court){ document.getElementById('kh_person').value=''; }
      document.getElementById('kh_courtFld').style.display=ty==='return_court'?'':'none';
    }
    var proof={mode:'',file:''};
    var camB=document.getElementById('kh_proofCam'), sysB=document.getElementById('kh_proofSys'), fIn=document.getElementById('kh_proofFile');
    function proofPaint(){
      camB.style.borderColor=proof.mode==='file'?'var(--gold)':'var(--border-2)'; camB.style.background=proof.mode==='file'?'var(--gold-soft)':'var(--surface-2)';
      sysB.style.borderColor=proof.mode==='system'?'var(--gold)':'var(--border-2)'; sysB.style.background=proof.mode==='system'?'var(--gold-soft)':'var(--surface-2)';
      var d=sysB.querySelector('[data-dot]'); d.style.background=proof.mode==='system'?'#2f7a4d':'transparent';
      if(proof.file) document.getElementById('kh_proofCamTxt').textContent='تم الإرفاق: '+proof.file;
    }
    camB.addEventListener('click',function(){ fIn.click(); });
    fIn.addEventListener('change',function(){ if(fIn.files.length){ proof.mode='file'; proof.file=fIn.files[0].name; proofPaint(); } });
    sysB.addEventListener('click',function(){ proof.mode='system'; proofPaint(); });
    document.getElementById('kh_type').addEventListener('change',sync); sync();
    document.getElementById('keySaveBtn').addEventListener('click',function(){
      var type=document.getElementById('kh_type').value, m=META[type];
      var person=type==='internal'?document.getElementById('kh_personSel').value:type==='return_court'?(env.court||''):document.getElementById('kh_person').value.trim();
      var letter='';
      if(!person){ keyErr(type==='internal'?'اختر المستخدم من القائمة.':'اسم الطرف مطلوب.'); return; }
      if(type==='external'){
        var xOrg=(document.getElementById('kh_org').value||'').trim();
        var xRole=(document.getElementById('kh_role').value||'').trim();
        var xPhone=(document.getElementById('kh_phone').value||'').trim();
        if(!xPhone){ keyErr('رقم جوال الطرف الخارجي مطلوب.'); return; }
        if(!proof.mode){ keyErr('يلزم إثبات التسليم: صوّر/ارفع مستنداً أو اختر الإقرار عبر النظام.'); return; }
        person=person+(xOrg?' — '+xOrg:'')+(xRole?' ('+xRole+')':'')+' — '+xPhone;
      }
      var t=keyToday();
      var hoState=type==='external'&&proof.mode==='system'?'pending_confirm':m.state;
      env.handoffs.push({type:type, state:hoState, person:person, role:m.role, date:t.date, letter:letter, proof:proof.mode==='file'?proof.file:(proof.mode==='system'?'إقرار عبر النظام':'')});
      if(type==='external'&&proof.mode==='file') env.attachments.push({k:'letter', label:proof.file});
      keyPersist();
      if(type!=='internal'){ env.status=m.status; }
      var typeTxt={internal:'تسليم داخلي',external:'تسليم خارجي',receive_back:'استلام الظرف (استرداد العهدة)',return_court:'إرجاع للمحكمة'}[type];
      env.timeline.push({ev:'handoff',date:t.dt,detail:typeTxt+' — '+person+' ('+m.role+')'+(type==='external'?(proof.mode==='file'?' — إثبات: '+proof.file:' — بانتظار إقرار الجهة عبر النظام'):'')});
      keyCloseModal(); renderKeyDetail(env.id); showToast('تم تسجيل «'+typeTxt+'» على الظرف '+env.request+'.');
    });
  }

