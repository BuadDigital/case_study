+I('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>')+'<span>إيقاف مؤقت</span></div>';
    if(t.status==='paused') items+='<div class="act-row" data-task-act="resume" data-task-id="'+id+'">'+I('<polygon points="5 3 19 12 5 21 5 3"/>')+'<span>استئناف المهمة</span></div>';
    if(TASK_TYPES[t.type].letter) items+='<div class="act-row" data-task-act="letter" data-task-id="'+id+'">'+I('<path d="M3 21h18M6 21V10M18 21V10M4 10h16L12 3z"/>')+'<span>عرض خطاب التفويض</span></div>';
    if(taskActive(t)) items+='<div class="act-row" data-remind="'+id+'">'+I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>')+'<span>تذكير المنفّذ</span></div>';
    if(taskActive(t)) items+='<div class="act-row" data-task-