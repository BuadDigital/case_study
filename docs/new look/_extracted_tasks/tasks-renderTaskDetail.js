function renderTaskDetail(id){
    var t=TASKS.find(function(x){ return x.id===id; }); if(!t) return;
    var st=TASK_STATUS[t.status], ty=TASK_TYPES[t.type];
    var overdue=!TASK_TERMINAL[t.status] && t.dueAt < taskLive();
    var pr=TASK_PRIORITY[t.priority]||TASK_PRIORITY.medium;
    var actions='';
    if(t.status==='created') actions+='<button class="primary" data-task-act="start" data-task-id="'+esc(t.id)+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>بدء التنفيذ</span></button>';
    if(t.status==='in_progress') actions+='<button class="primary" data-task-close="'+esc(t.id)+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span>إغلاق المهمة (إكمال)</span></button>';
    if(t.status==='created'||t.status==='in_progress') actions+='<button class="btn-ghost" data-task-act="pause" data-task-id="'+esc(t.id)+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-inline-end:6px"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>إيقاف مؤقت</button>';
    if(t.status==='paused') actions+='<button class="primary" data-task-act="resume" data-task-id="'+esc(t.id)+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>استئناف المهمة</span></button>';
    if(ty.letter && t.letterRows && t.letterRows.length) actions+='<button class="btn-ghost" data-print-letter="'+esc(t.id)+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-inline-end:6px"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>طباعة خطاب التفويض</button>';
    if(taskActive(t)) actions+='<button class="btn-ghost" data-task-prio="'+esc(t.id)+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-inline-end:6px"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>تغيير الأولوية</button>';
    if(taskActive(t)) actions+='<button class="btn-ghost" data-task-reassign="'+esc(t.id)+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-inline-end:6px"><path d="M5 12h14M13 6l6 6-6 6"/></svg>إعادة توجيه وإسناد</button>';
    if(!TASK_TERMINAL[t.status]) actions+='<button class="btn-ghost" data-task-act="cancel" data-task-id="'+esc(t.id)+'" style="color:#c0553d">إلغاء المهمة</button>';
    var linkChip = t.scope==='general' ? 'غير مرتبطة — مهمة مستقلة' : esc(TASK_SCOPES[t.scope]+' · '+taskScopeText(t));
    var rm=TASK_REMIND[t.priority]||TASK_REMIND.medium;
    var nSent=(t.reminders?t.reminders.length:0);
    var remindBlock = !taskActive(t) ? '' :
      '<div class="remind-card"><div style="display:flex;align-items:center;gap:12px"><span style="width:38px;height:38px;border-radius:10px;flex:none;display:grid;place-items:center;background:color-mix(in srgb,var(--gold) 18%,transparent);color:var(--gold-d)"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></span><div><div style="font-weight:800;color:var(--heading);font-size:13.5px">التذكير التلقائي</div><div style="font-size:12px;color:var(--text-2);margin-top:2px">أولوية <b style="color:'+pr.c+'">'+pr.t+'</b> · '+rm.label+' — التذكير القادم خلال <span id="tkNextRemind" style="font-weight:700;color:var(--heading)">'+remindCountdownStr(t)+'</span>'+(nSent?' · أُرسل '+nSent+' تذكير':'')+'</div></div></div><button type="button" class="remind-btn" data-remind="'+esc(t.id)+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span>تذكير الآن</span></button></div>';
    var letterBlock='';
    if(ty.letter){
      letterBlock='<div class="letter-card"><div class="letter-head"><div style="display:flex;align-items:center;gap:11px"><span style="width:36px;height:36px;border-radius:10px;background:var(--gold-soft);color:var(--gold-d);display:grid;place-items:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M6 21V10M18 21V10M4 10h16L12 3z"/></svg></span><div><div style="font-weight:800;color:var(--heading);font-size:13.5px">خطاب التفويض الداخلي</div><div style="font-size:11.5px;color:var(--text-3)">مفتاح التجميع: المحكمة + الدائرة · لقطة (snapshot) عند الإصدار</div></div></div><span style="font-size:12px;color:var(--text-2);font-weight:700">الرقم المرجعي: <span dir="ltr" style="color:var(--gold-d)">'+esc(t.ref||'—')+'</span></span></div><div style="padding:16px 18px">'+letterTableHtml(t.letterRows||[])+'<p style="font-size:11.5px;color:var(--text-3);margin:12px 2px 0">الترميز المرجعي الموحّد + snapshot للبيانات وقت الإصدار — يُطبع على الترويسة الرسمية. (المرجع: authorization_letter_spec_final.md)</p></div></div>';
    }
    document.getElementById('view-taskDetail').innerHTML =
      '<button class="back-link" data-nav-tasks="1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg><span>المهام</span></button>'+
      '<div class="pp-head"><h1 class="pp-title"><span style="display:inline-flex;align-items:center;gap:9px">'+typeIco(t.type,20)+esc(t.title)+'</span></h1>'+
        '<div class="pp-meta"><span class="pp-badge" style="background:var(--gold-soft);color:var(--gold-d)">'+esc(ty.label)+'</span><span style="color:var(--text-3)">·</span>'+pill(st.t,st.c)+'<span style="color:var(--text-3)">·</span><span dir="ltr">'+esc(t.id)+'</span>'+(t.ref?'<span style="color:var(--text-3)">·</span><span>خطاب '+esc(t.ref)+'</span>':'')+'</div>'+
        '<div style="margin-top:16px">'+taskStepper(t)+'</div>'+
        '<div class="pp-summary">'+
          '<div class="pp-cell"><div class="k">المنفّذ</div><div class="v">'+esc(asgName(t.assignee))+' — '+esc(asgRole(t.assignee))+'</div></div>'+
          '<div class="pp-cell"><div class="k">المنشئ</div><div class="v">'+esc(CREATOR)+'</div></div>'+
          '<div class="pp-cell"><div class="k">النطاق / الربط</div><div class="v">'+linkChip+'</div></div>'+
          '<div class="pp-cell"><div class="k">الأولوية</div><div class="v">'+pill(pr.t,pr.c)+'</div></div>'+
          '<div class="pp-cell"><div class="k">تاريخ الإنشاء</div><div class="v">'+esc(taskDueLabel(t.createdAt))+'</div></div>'+
          '<div class="pp-cell"><div class="k">موعد الاستحقاق</div><div class="v"'+(overdue?' style="color:#d9694f"':'')+'>'+(overdue?'متأخرة · ':'')+esc(taskDueLabel(t.dueAt))+'</div></div>'+
        '</div>'+
      '</div>'+
      (t.desc?'<div class="task-desc">'+esc(t.desc)+'</div>':'')+
      remindBlock+
      letterBlock+
      (actions?'<div class="tf-actions">'+actions+'</div>':'')+
      commentThreadHtml(t);
    var ct=document.getElementById('cmtText');
    if(ct) ct.addEventListener('input', function(e){ if(DRAFT.taskId!==t.id) DRAFT={taskId:t.id,text:'',files:[]}; DRAFT.text=e.target.value; });    var cf=document.getElementById('cmtFile');
    if(cf) cf.addEventListener('change', function(e){ if(DRAFT.taskId!==t.id) DRAFT={taskId:t.id,text:(ct?ct.value:''),files:[]}; DRAFT.text=ct?ct.value:DRAFT.text; Array.from(e.target.files).forEach(function(f){ DRAFT.files.push({name:f.name,size:fmtSize(f.size)}); }); renderTaskDetail(t.id); });
    setHeader(t.title, crumb(['لوحة التحكم','المهام',t.id])); navActive('المهام'); showView('taskDetail');
    if(taskTimer){ clearInterval(taskTimer); taskTimer=null; }
    if(taskActive(t)){
      taskTimer=setInterval(function(){
        var el=document.getElementById('tkNextRemind');
        if(!el || document.getElementById('view-taskDetail').hidden){ clearInterval(taskTimer); taskTimer=null; return; }
        if(nextReminderTs(t)-taskLive() <= 0){ if(!t.reminders) t.reminders=[]; t.reminders.push({at:taskLive(),auto:true}); addComment(t.id,'system','🔔 تذكير تلقائي أُرسل إلى المنفّذ حسب الأولوية.',[],'reminder'); showToast('تذكير تلقائي أُرسل إلى '+asgName(t.assignee)); renderTaskDetail(t.id); return; }
        el.innerHTML=remindCountdownStr(t);
      }, 1000);
    }
  }