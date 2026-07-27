function openReassignModal(id){
    var t=TASKS.find(function(x){ return x.id===id; }); if(!t) return;
    RSMODAL={ id:id }; removeReassignModal();
    var dd=new Date(t.dueAt);
    var asgOpts=ASSIGNEES.map(function(a){ return '<option value="'+a.id+'"'+(a.id===t.assignee?' selected':'')+'>'+esc(a.name+' — '+a.role)+'</option>'; }).join('');
    var ov=document.createElement('div'); ov.id='rsModalOverlay'; ov.className='modal-overlay';
    ov.innerHTML='<div class="modal" role="dialog" aria-modal="true" style="max-width:520px">'+
      '<div class="modal-head"><div><h2>إعادة توجيه وإسناد المهمة</h2><div style="font-size:11.5px;color:var(--text-3);margin-top:3px">أعد إسناد المهمة إلى منفّذ آخر مع ضبط موعد التسليم وذكر السبب</div></div><button class="modal-x" data-rs-cancel aria-label="إغلاق">✕</button></div>'+
      '<div class="modal-body">'+
        '<div id="rsError" class="modal-error" hidden></div>'+
        '<div style="font-size:12.5px;color:var(--text-2);margin-bottom:12px">المنفّذ الحالي: <b style="color:var(--heading)">'+esc(asgName(t.assignee))+'</b> — '+esc(asgRole(t.assignee))+'</div>'+
        '<label class="tf-lbl">إسناد إلى *</label><select id="rsAsg" style="'+INP_STYLE+';width:100%">'+asgOpts+'</select>'+
        '<label class="tf-lbl" style="margin-top:14px">موعد التسليم</label><div style="display:flex;gap:10px;flex-wrap:wrap"><input id="rsDate" type="date" value="'+isoFromTs(t.dueAt)+'" style="'+INP_STYLE+';max-width:180px"><input id="rsTime" type="time" value="'+pad2(dd.getHours())+':'+pad2(dd.getMinutes())+'" style="'+INP_STYLE+';max-width:140px"></div>'+
        '<label class="tf-lbl" style="margin-top:14px">سبب التوجيه *</label><textarea id="rsReason" rows="2" placeholder="مثال: المنفّذ الحالي في مهمة عاجلة أخرى…" style="'+INP_STYLE+';width:100%;resize:vertical"></textarea>'+
      '</div>'+
      '<div class="modal-foot"><button class="btn-ghost" data-rs-cancel>إلغاء</button><button class="primary" data-rs-apply><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg><span>إعادة التوجيه</span></button></div>'+
    '</div>';
    document.body.appendChild(ov);
    setTimeout(function(){ var r=document.getElementById('rsReason'); if(r) r.focus(); }, 40);
  }