function renderTaskNew(prefill){
    var dHalf=new Date(NOW + TASK_PRIORITY.medium.off);
    TF={ type:'', scope:'transaction', po:'', deeds:[], priority:'medium', date:isoFromTs(NOW + TASK_PRIORITY.medium.off), time:pad2(dHalf.getHours())+':'+pad2(dHalf.getMinutes()) };
    if(prefill) for(var kk in prefill) TF[kk]=prefill[kk];
    var prioBtns=['high','medium','low'].map(function(k){ return '<button type="button" class="tf-seg" data-prio="'+k+'">'+TASK_PRIORITY[k].t+'</button>'; }).join('');
    var typeOpts=Object.keys(TASK_TYPES).map(function(k){ return '<option value="'+k+'"'+(TF.type===k?' selected':'')+'>'+esc(TASK_TYPES[k].label)+'</option>'; }).join('');
    var asgOpts=ASSIGNEES.map(function(a){ return '<option value="'+a.id+'">'+esc(a.name+' — '+a.role)+'</option>'; }).join('');
    var scopeBtns=Object.keys(TASK_SCOPES).map(function(k){ return '<button type="button" class="tf-seg" data-scope="'+k+'">'+esc(TASK_SCOPES[k])+'</button>'; }).join('');
    closeTaskModal();
    var ov=document.createElement('div'); ov.id='taskModalOverlay'; ov.className='modal-overlay';
    ov.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" style="max-width:720px">'+
      '<div class="modal-head"><div><h2>مهمة جديدة</h2><div style="font-size:11.5px;color:var(--text-3);margin-top:3px">واجهة موحّدة للإنشاء والإسناد — «زيارة محكمة» يفعّل خطاب التفويض</div></div><button class="modal-x" id="tfCancel" aria-label="إغلاق">✕</button></div>'+
      '<div class="modal-body" style="max-height:70vh;overflow-y:auto">'+
        '<div id="tfError" class="modal-error" hidden></div>'+
        '<div class="form-grid">'+
          '<div class="fld"><label>نوع المهمة *</label><select id="tfType"><option value="">اختر النوع…</option>'+typeOpts+'</select></div>'+
          '<div class="fld"><label>مُسندة إلى *</label><select id="tfAssignee"><option value="">اختر المنفّذ…</option>'+asgOpts+'</select></div>'+
          '<div class="fld full"><label>عنوان المهمة *</label><input id="tfTitle" placeholder="مثال: زيارة محكمة التنفيذ بجدة" /></div>'+
          '<div class="fld full"><label>الوصف</label><textarea id="tfDesc" rows="2" placeholder="تفاصيل إضافية للمنفّذ (اختياري)"></textarea></div>'+
          '<div class="fld full"><label>نطاق الربط *</label><div class="tf-seg-row" id="tfScope">'+scopeBtns+'</div></div>'+
          '<div class="fld full" id="tfLink"></div>'+
          '<div class="fld full"><label>الأولوية *</label><div class="tf-seg-row" id="tfPrio">'+prioBtns+'</div><span style="font-size:11px;color:var(--text-3);margin-top:7px;display:block">تضبط الأولوية موعد الاستحقاق المقترح — «متوسطة» (الافتراضي) تعادل نصف يوم.</span></div>'+
          '<div class="fld full"><label>موعد الاستحقاق * <span style="color:var(--text-3);font-weight:500">(يوم + ساعة)</span></label>'+
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:11px"><button type="button" class="tf-chip" data-due="today">اليوم</button><button type="button" class="tf-chip" data-due="tomorrow">غداً</button><button type="button" class="tf-chip" data-due="after">بعد غد</button></div>'+
            '<div style="display:flex;gap:10px;flex-wrap:wrap"><input id="tfDate" type="date" value="'+TF.date+'" style="max-width:190px" /><input id="tfTime" type="time" value="'+TF.time+'" style="max-width:150px" /></div>'+
          '</div>'+
        '</div>'+
        '<div id="tfLetter" hidden></div>'+
      '</div>'+
      '<div class="modal-foot"><button class="btn-ghost" id="tfCancel2">إلغاء</button><button class="primary" id="tfSubmit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span>إنشاء المهمة</span></button></div>'+
      '</div>';
    document.body.appendChild(ov);
    var typeSel=document.getElementById('tfType');
    typeSel.addEventListener('change', function(e){
      TF.type=e.target.value;
      var ti=document.getElementById('tfTitle');
      if(TF.type && !ti.value.trim()) ti.value=TASK_TYPES[TF.type].label;
      if(TF.type==='court_visit' && TF.scope==='transaction'){ TF.scope='work_order'; tfSyncScope(); tfRenderLink(); }
      tfRenderPreview();
    });
    document.querySelectorAll('#tfScope .tf-seg').forEach(function(b){ b.addEventListener('click', function(){ TF.scope=b.getAttribute('data-scope'); tfSyncScope(); tfRenderLink(); tfRenderPreview(); }); });
    document.querySelectorAll('#tfPrio .tf-seg').forEach(function(b){ b.addEventListener('click', function(){
      TF.priority=b.getAttribute('data-prio'); tfSyncPrio();
      var due=NOW + TASK_PRIORITY[TF.priority].off, d=new Date(due);
      var iso=isoFromTs(due), tm=pad2(d.getHours())+':'+pad2(d.getMinutes());
      TF.date=iso; TF.time=tm;
      document.getElementById('tfDate').value=iso; document.getElementById('tfTime').value=tm;
      document.querySelectorAll('[data-due]').forEach(function(x){ x.classList.remove('active'); });
    }); });
    document.querySelectorAll('[data-due]').forEach(function(c){ c.addEventListener('click', function(){
      var k=c.getAttribute('data-due'), off=k==='today'?0:(k==='tomorrow'?1:2);
      var iso=isoFromTs(NOW+off*DAY); document.getElementById('tfDate').value=iso; TF.date=iso;
      document.querySelectorAll('[data-due]').forEach(function(x){ x.classList.remove('active'); }); c.classList.add('active');
    }); });
    document.getElementById('tfDate').addEventListener('change', function(e){ TF.date=e.target.value; document.querySelectorAll('[data-due]').forEach(function(x){ x.classList.remove('active'); }); });
    document.getElementById('tfTime').addEventListener('change', function(e){ TF.time=e.target.value; });
    if(TF.type) typeSel.value=TF.type;
    tfSyncScope(); tfSyncPrio(); tfRenderLink(); tfRenderPreview();
    setTimeout(function(){ if(typeSel && document.body.contains(typeSel)) typeSel.focus(); }, 40);
  }