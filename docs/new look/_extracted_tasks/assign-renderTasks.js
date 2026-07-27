function renderTasks(){
    var counts={in_progress:0,paused:0,completed:0,cancelled:0};
    TASKS.forEach(function(t){ counts[t.status]=(counts[t.status]||0)+1; });
    var active=counts.in_progress+counts.paused;
    var statusOpts=Object.keys(TASK_STATUS).map(function(k){ return '<option value="'+k+'">'+TASK_STATUS[k].t+'</option>'; }).join('');
    var scopeOpts=Object.keys(TASK_SCOPES).map(function(k){ return '<option value="'+k+'">'+TASK_SCOPES[k]+'</option>'; }).join('');
    var cols='40px minmax(170px,1.8fr) minmax(110px,1.1fr) minmax(120px,1.1fr) minmax(120px,1.2fr) minmax(84px,.85fr) 84px';
    document.getElementById('view-tasks').innerHTML =
      '<div class="kpi">'+
        '<div class="first"><div class="kpi-head"><span class="kpi-ico gold"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 2h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="m9 14 2 2 4-4"/></svg></span><span>مهام نشطة</span></div><div class="kpi-num">'+active+'</div><div class="kpi-sub"><span class="g"></span>قيد الإسناد والتنفيذ</div></div>'+
        '<div><div class="kpi-head"><span class="kpi-ico" style="background:color-mix(in srgb,'+NAVY+' 10%,transparent);color:'+NAVY+'"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4"/></svg></span><span>متوقفة مؤقتاً</span></div><div class="kpi-num">'+counts.paused+'</div><div class="kpi-sub">بانتظار الاستئناف</div></div>'+
        '<div><div class="kpi-head"><span class="kpi-ico" style="background:color-mix(in srgb,#d9a441 20%,transparent);color:#8a5e14"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span><span>قيد التنفيذ</span></div><div class="kpi-num">'+counts.in_progress+'</div><div class="kpi-sub">جارية الآن</div></div>'+
        '<div><div class="kpi-head"><span class="kpi-ico" style="background:color-mix(in srgb,#3f8f5f 16%,transparent);color:#2f7a4d"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg></span><span>مكتملة</span></div><div class="kpi-num">'+counts.completed+'</div><div class="kpi-sub">أُنجزت مؤخراً</div></div>'+
      '</div>'+
      '<div class="toolbar"><div class="filters" style="flex:1">'+
        '<div class="search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input id="tkSearch" type="text" placeholder="عنوان المهمة أو المنفّذ أو رقم الصك…" /></div>'+
        '<div class="sel"><select id="tkStatus"><option value="">جميع الحالات</option>'+statusOpts+'</select>'+CARET+'</div>'+
        '<div class="sel"><select id="tkScope"><option value="">كل النطاقات</option>'+scopeOpts+'</select>'+CARET+'</div>'+
        '<button id="tkShowAll" type="button" style="display:inline-flex;align-items:center;gap:7px;padding:8px 13px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:12.5px;font-weight:700;cursor:pointer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span>إظهار جميع المهام</span></button>'+
        '<span id="tkCount" style="margin-inline-start:auto;font-size:12.5px;color:var(--text-3);font-weight:600"></span>'+
        '</div>'+
        '<button class="primary" id="tasksNewBtn" style="margin-inline-start:12px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg><span>إنشاء مهمة</span></button>'+
      '</div>'+
      '<div id="tkBulk" style="display:none;align-items:center;gap:12px;background:var(--ink);color:#fff;border-radius:11px;padding:11px 16px;margin-bottom:14px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold-2)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span id="tkSelCount" style="font-weight:700;font-size:13px"></span><button type="button" class="remind-btn" data-bulk-remind style="margin-inline-start:auto"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span>تذكير المحدد دفعة واحدة</span></button><button type="button" data-bulk-clear style="background:none;border:1px solid rgba(255,255,255,.35);color:#fff;font-size:12.5px;font-weight:600;padding:9px 14px;border-radius:8px;cursor:pointer;font-family:inherit">إلغاء التحديد</button></div>'+
      '<div class="card"><div class="scroll"><div class="grid" style="min-width:100%">'+
        '<div class="thead" style="grid-template-columns:'+cols+'"><div class="th c"><input type="checkbox" id="tkSelAll" aria-label="تحديد الكل"></div><div class="th">المهمة</div><div class="th">النطاق / الربط</div><div class="th">المنفّذ</div><div class="th">الاستحقاق</div><div class="th">الحالة</div><div class="th c">إجراءات</div></div>'+
        '<div id="tkRows"></div></div></div>'+
        '<div style="padding:11px 16px;border-top:1px solid var(--border);font-size:12px;color:var(--text-3)">اضغط الصف لعرض تفاصيل المهمة. المراجعة الحكومية وخطاب التفويض حالتان من هذه الطبقة.</div>'+
      '</div>';
    var draw=function(){
      var q=TASK_STATE.search.trim();
      var rows=TASKS.filter(function(t){
        var okQ=!q||(t.title+' '+asgName(t.assignee)+' '+(t.deeds?t.deeds.join(' '):'')+' '+(t.po||'')+' '+t.id).indexOf(q)!==-1;
        var okS=!TASK_STATE.status||t.status===TASK_STATE.status;
        var okC=!TASK_STATE.scope||t.scope===TASK_STATE.scope;
        var okShow=TASK_STATE.showAll||TASK_STATE.status||taskActive(t);
        return okQ&&okS&&okC&&okShow;
      });
      rows.sort(function(a,b){
        var rk=function(s){ return s==='paused'?1:(TASK_TERMINAL[s]?2:0); };
        var ra=rk(a.status), rb=rk(b.status);
        if(ra!==rb) return ra-rb;
        if(ra===2) return b.dueAt-a.dueAt;
        return a.dueAt-b.dueAt;
      });
      document.getElementById('tkRows').innerHTML = rows.length ? rows.map(taskRow).join('') : '<div style="padding:44px 16px;text-align:center;color:var(--text-3);font-size:13.5px">لا توجد مهام مطابقة.</div>';
      document.getElementById('tkCount').textContent = rows.length+' مهمة';
      var boxes=document.querySelectorAll('#tkRows [data-tk-sel]'), sa=document.getElementById('tkSelAll'), ck=0;
      boxes.forEach(function(b){ if(b.checked) ck++; });
      sa.checked = boxes.length>0 && ck===boxes.length; sa.indeterminate = ck>0 && ck<boxes.length;
      updateBulk();
    };
    document.getElementById('tkRows').addEventListener('change', function(e){
      var cb=e.target.closest('[data-tk-sel]'); if(!cb) return;
      var id=cb.getAttribute('data-tk-sel'); if(cb.checked) TASK_SEL[id]=true; else delete TASK_SEL[id];
      var boxes=document.querySelectorAll('#tkRows [data-tk-sel]'), sa=document.getElementById('tkSelAll'), ck=0;
      boxes.forEach(function(b){ if(b.checked) ck++; });
      sa.checked=boxes.length>0&&ck===boxes.length; sa.indeterminate=ck>0&&ck<boxes.length; updateBulk();
    });
    document.getElementById('tkSelAll').addEventListener('change', function(e){
      var on=e.target.checked;
      document.querySelectorAll('#tkRows [data-tk-sel]').forEach(function(cb){ cb.checked=on; var id=cb.getAttribute('data-tk-sel'); if(on) TASK_SEL[id]=true; else delete TASK_SEL[id]; });
      e.target.indeterminate=false; updateBulk();
    });
    document.querySelector('[data-bulk-remind]').addEventListener('click', bulkRemind);
    document.querySelector('[data-bulk-clear]').addEventListener('click', function(){ TASK_SEL={}; renderTasks(); });
    document.getElementById('tkSearch').addEventListener('input', function(e){ TASK_STATE.search=e.target.value; draw(); });
    document.getElementById('tkStatus').addEventListener('change', function(e){ TASK_STATE.status=e.target.value; draw(); });
    document.getElementById('tkScope').addEventListener('change', function(e){ TASK_STATE.scope=e.target.value; draw(); });
    document.getElementById('tkShowAll').addEventListener('click', function(){ TASK_STATE.showAll=!TASK_STATE.showAll; var on=TASK_STATE.showAll; this.style.background=on?'var(--ink)':'var(--surface)'; this.style.color=on?'#fff':'var(--text-2)'; this.style.borderColor=on?'var(--ink)':'var(--border-2)'; this.querySelector('span').textContent=on?'النشطة فقط':'إظهار جميع المهام'; draw(); });
    draw();
    if(tkListTimer){ clearInterval(tkListTimer); tkListTimer=null; }
    tkListTimer=setInterval(function(){
      if(!document.getElementById('view-tasks') || document.getElementById('view-tasks').hidden){ clearInterval(tkListTimer); tkListTimer=null; return; }
      document.querySelectorAll('#tkRows [data-cd]').forEach(function(el){
        var t=TASKS.find(function(x){ return x.id===el.getAttribute('data-cd'); }); if(!t) return;
        var cd=taskCountdown(t); el.innerHTML=cd.txt; el.style.color=cd.over?'#d9694f':'var(--heading)';
        var dot=el.parentNode.querySelector('.cd-dot'), u=taskUrgency(t);
        if(dot && u){ dot.style.background=u.c; dot.className='cd-dot'+(u.pulse?' live':''); }
      });
    }, 1000);
    setHeader('المهام', crumb(['لوحة التحكم','المهام'])); navActive('المهام'); showView('tasks');
  }