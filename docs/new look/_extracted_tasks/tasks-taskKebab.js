function taskKebab(t){
    var id=esc(t.id), items='';
    var I=function(p){ return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>'; };
    items+='<div class="act-row" data-task-act="detail" data-task-id="'+id+'">'+I('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>')+'<span>عرض التفاصيل</span></div>';
    if(t.status==='created') items+='<div class="act-row" data-task-act="start" data-task-id="'+id+'">'+I('<polygon points="5 3 19 12 5 21 5 3"/>')+'<span>بدء التنفيذ</span></div>';
    if(t.status==='in_progress') items+='<div class="act-row" data-task-close="'+id+'">'+I('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>')+'<span>إغلاق المهمة (إكمال)</span></div>';
    if(t.status==='created'||t.status==='in_progress') items+='<div class="act-row" data-task-act="pause" data-task-id="'+id+'">'+I('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>')+'<span>إيقاف مؤقت</span></div>';
    if(t.status==='paused') items+='<div class="act-row" data-task-act="resume" data-task-id="'+id+'">'+I('<polygon points="5 3 19 12 5 21 5 3"/>')+'<span>استئناف المهمة</span></div>';
    if(TASK_TYPES[t.type].letter) items+='<div class="act-row" data-task-act="letter" data-task-id="'+id+'">'+I('<path d="M3 21h18M6 21V10M18 21V10M4 10h16L12 3z"/>')+'<span>عرض خطاب التفويض</span></div>';
    if(taskActive(t)) items+='<div class="act-row" data-remind="'+id+'">'+I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>')+'<span>تذكير المنفّذ</span></div>';
    if(taskActive(t)) items+='<div class="act-row" data-task-prio="'+id+'">'+I('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>')+'<span>تغيير الأولوية</span></div>';
    if(taskActive(t)) items+='<div class="act-row" data-task-reassign="'+id+'">'+I('<path d="M5 12h14M13 6l6 6-6 6"/>')+'<span>إعادة توجيه وإسناد</span></div>';
    if(!TASK_TERMINAL[t.status]) items+='<div class="act-sep"></div><div class="act-row danger" data-task-act="cancel" data-task-id="'+id+'">'+I('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>')+'<span>إلغاء المهمة</span></div>';
    return '<div class="actions"><button class="kebab" aria-label="خيارات المهمة"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button><div class="act-pop">'+items+'</div></div>';
  }