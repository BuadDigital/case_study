function openCloseModal(id,forced){
    var t=TASKS.find(function(x){ return x.id===id; }); if(!t) return;
    CLOSEDRAFT={ files:[], result: forced||'completed' }; removeCloseModal();
    var isCancel=forced==='cancelled';
    var ov=document.createElement('div'); ov.id='closeModalOverlay'; ov.className='modal-overlay';
    ov.innerHTML='<div class="modal" role="dialog" aria-modal="true" style="max-width:540px">'+
      '<div class="modal-head"><div><h2>'+(isCancel?'إلغاء المهمة':'إغلاق المهمة — منجزة')+'</h2><div style="font-size:11.5px;color:var(--text-3);margin-top:3px">'+(isCancel?'صلاحية منشئ المهمة — يتطلب سبباً إلزامياً':'يقوم المنفّذ بإغلاق المهمة بعد إتمام العمل المطلوب')+'</div></div><button class="modal-x" data-close-cancel aria-label="إغلاق">✕</button></div>'+
      '<div class="modal-body">'+
        '<div style="background:'+(isCancel?'color-mix(in srgb,#d9694f 9%,transparent)':'color-mix(in srgb,#3f8f5f 9%,transparent)')+';border:1px solid '+(isCancel?'color-mix(in srgb,#d9694f 30%,transparent)':'color-mix(in srgb,#3f8f5f 30%,transparent)')+';border-radius:10px;padding:11px 13px;font-size:12.5px;color:var(--text-2);margin-bottom:14px">سيتم تحويل حالة المهمة إلى <b style="color:'+(isCancel?'#c0553d':'#2f7a4d')+'">'+(isCancel?'ملغاة':'منجزة')+'</b> وإشعار '+(isCancel?'المنفّذ':'المنشئ')+'.</div>'+
        (!isCancel&&t.type==='court_visit'?'<div id="cvBox"><label class="tf-lbl">موقف المفاتيح لدى المحكمة * <span style="font-weight:600;color:var(--text-3)">(اختيار واحد)</span></label><div style="display:grid;gap:7px;margin-bottom:12px" id="cvOpts">'+[['received','استُلم ظرف مفاتيح'],['other_party','الظرف عند طرف آخر (إفادة الدائرة)'],['none','لا توجد مفاتيح مسجلة لدى الدائرة'],['other','أخرى']].map(function(o){ return '<label data-cvlbl="'+o[0]+'" style="display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--text);cursor:pointer"><input type="radio" name="cvKind" value="'+o[0]+'" style="accent-color:var(--gold-d);width:15px;height:15px;flex:none"><span>'+o[1]+'</span></label>'; }).join('')+'</div>'+
        '<div id="cvOtherBox" hidden style="margin-bottom:12px"><input id="cvOtherText" placeholder="اذكر النتيجة… *" style="'+INP_STYLE+';width:100%"></div>'+
        '<label class="tf-lbl">إفادة المحكمة على مستوى الطلب</label>'+
        '<div id="cvAllBox"><textarea id="cvAllText" rows="2" placeholder="نص الإفادة العامة للطلب…" style="'+INP_STYLE+';width:100%;resize:vertical;margin-bottom:12px"></textarea></div>'+
        ((t.letterRows||[]).length?'<label class="tf-lbl">إفادات الصكوك <span style="font-weight:600;color:var(--text-3)">(إن وجدت)</span></label>':'')+
        '<div id="cvPerBox" style="display:grid;gap:8px;margin-bottom:12px">'+(t.letterRows||[]).map(function(rw){ return '<div style="display:flex;align-items:center;gap:9px"><span dir="ltr" style="flex:none;font-size:11.5px;font-weight:700;color:var(--gold-d);min-width:96px">صك '+esc(rw.deed)+'</span><input data-cv-deed="'+esc(rw.deed)+'" placeholder="إفادة هذا الصك…" style="'+INP_STYLE+';flex:1" /></div>'; }).join('')+'</div>'+
        '<div id="cvContactsWrap" hidden><label class="tf-lbl">بيانات التواصل مع الأطراف * <span style="font-weight:600;color:var(--text-3)">(على مستوى العقار أو الصك)</span></label>'+
        '<div id="cvContacts" style="display:grid;gap:8px;margin-bottom:8px"></div>'+
        '<button type="button" class="attach-btn" data-cv-addcontact style="margin-bottom:14px"><span>+ إضافة جهة اتصال</span></button></div>'+
      '</div>':'')+
        (!isCancel&&t.prevAssignees&&t.prevAssignees.length?'<div id="creditBox"><label class="tf-lbl">تُسجَّل مسؤولية التنفيذ لـ</label><select id="creditSel" style="'+INP_STYLE+';width:100%">'+t.prevAssignees.concat([t.assignee]).map(function(aid,i){ return '<option value="'+aid+'"'+(i===0?' selected':'')+'>'+esc(asgName(aid))+(i===0?' (المنفّذ الأول)':(i===t.prevAssignees.length?' (الحالي)':''))+'</option>'; }).join('')+'</select><div style="font-size:11px;color:var(--text-3);margin:6px 0 12px">أُعيد توجيه المهمة سابقاً — تُسجَّل افتراضياً للمنفّذ الأول، ويمكن للمشرف تعديلها.</div></div>':'')+
        '<label class="tf-lbl" id="closeNoteLbl">'+(isCancel?'سبب الإلغاء *':'تعليق الإغلاق')+'</label><textarea id="closeNote" rows="3" placeholder="'+(isCancel?'اذكر سبب الإلغاء (إلزامي)…':'لخّص ما تم إنجازه…')+'" style="width:100%;font-family:inherit;padding:11px 13px;border:1px solid var(--border-2);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;outline:none;resize:vertical"></textarea>'+
        '<div id="closePend"></div>'+
        '<button type="button" class="attach-btn" data-close-attach style="margin-top:11px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49"/></svg><span>إرفاق مستند</span></button><input type="file" id="closeFile" multiple hidden>'+
      '</div>'+
      '<div class="modal-foot"><button class="btn-ghost" data-close-cancel>إلغاء</button><button class="primary" data-close-confirm="'+esc(id)+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span>'+(isCancel?'تأكيد الإلغاء':'إغلاق المهمة')+'</span></button></div>'+
    '</div>';
    document.body.appendChild(ov);
    document.getElementById('closeFile').addEventListener('change', function(e){ Array.from(e.target.files).forEach(function(f){ CLOSEDRAFT.files.push({name:f.name,size:fmtSize(f.size)}); }); renderClosePend(); });
    if(t.type==='court_visit'){
      var cvScopeSel=function(){ return '<select data-c="scope" style="'+INP_STYLE+'"><option value="property">العقار</option>'+(t.letterRows||[]).map(function(rw){ return '<option value="'+esc(rw.deed)+'">صك '+esc(rw.deed)+'</option>'; }).join('')+'</select>'; };
      var contactRow=function(){ return '<div class="cv-contact" style="display:grid;grid-template-columns:.9fr 1.2fr 1fr 1fr 1.1fr auto;gap:7px;align-items:center">'+cvScopeSel()+'<input data-c="name" placeholder="الاسم *" style="'+INP_STYLE+'"><input data-c="role" placeholder="الصفة" style="'+INP_STYLE+'"><input data-c="phone" dir="ltr" placeholder="05xxxxxxxx" style="'+INP_STYLE+'"><input data-c="note" placeholder="ملاحظات" style="'+INP_STYLE+'"><button type="button" data-cv-rmcontact style="width:30px;height:30px;border:none;background:none;color:var(--text-3);cursor:pointer;font-size:15px" aria-label="حذف">✕</button></div>'; };
      ov.addEventListener('click', function(e){
        var ck=e.target.closest('input[name="cvKind"]');
        if(ck&&ck.checked){ var k=ck.value;
          var cw=document.getElementById('cvContactsWrap'); if(cw){ cw.hidden=k!=='other_party'; }
          if(k==='other_party'&&!document.querySelector('#cvContacts .cv-contact')){ var d0=document.createElement('div'); d0.innerHTML=contactRow(); document.getElementById('cvContacts').appendChild(d0.firstChild); }
          var ob=document.getElementById('cvOtherBox'); if(ob){ ob.hidden=k!=='other'; if(k==='other'){ setTimeout(function(){ var oi=document.getElementById('cvOtherText'); if(oi) oi.focus(); },30); } }
        }
        if(e.target.closest('[data-cv-addcontact]')){ var d=document.createElement('div'); d.innerHTML=contactRow(); document.getElementById('cvContacts').appendChild(d.firstChild); return; }
        var rm=e.target.closest('[data-cv-rmcontact]'); if(rm){ rm.closest('.cv-contact').remove(); return; }
      });
    }
    setTimeout(function(){ var n=document.getElementById('closeNote'); if(n) n.focus(); }, 40);
  }