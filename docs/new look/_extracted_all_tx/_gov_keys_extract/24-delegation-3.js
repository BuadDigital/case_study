ids=Object.keys(TASK_SEL).filter(function(id){ return TASK_SEL[id]; }), n=0;
    ids.forEach(function(id){ var t=TASKS.find(function(x){ return x.id===id; }); if(t && taskActive(t)){ if(!t.reminders) t.reminders=[]; t.reminders.push({at:taskLive(),auto:false}); addComment(id,'system','🔔 تم إرسال تذكير فوري إلى المنفّذ.',[],'reminder'); n++; } });
    TASK_SEL={};
    showToast(n ? ('تم إرسال تذكير إلى '+n+' مهمة دفعة واحدة') : 'لا مهام قابلة للتذكير ضمن المحدد');
    renderTasks();
  }

  // ── خطاب التفويض (مخرَج مهمة زيارة المحكمة) ──
  function letterTableHtml(rows){
    if(!rows.length) return '<div style="padding:24px;text-align:center;color:var(--text-3);font-size:12.5px">اختر الصكوك المرتبطة لعرض معاينة الخطاب.</div>';
    var gcols='44px minmax(84px,.9fr) minmax(120px,1.2fr) minmax