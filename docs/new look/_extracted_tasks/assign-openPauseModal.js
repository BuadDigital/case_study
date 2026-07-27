function openPauseModal(id){
    var t=TASKS.find(function(x){ return x.id===id; }); if(!t) return; removePauseModal();
    var ov=document.createElement('div'); ov.id='pauseModalOverlay'; ov.className='modal-overlay';
    ov.innerHTML='<div class="modal" role="dialog" aria-modal="true" style="max-width:460px">'+
      '<div class="modal-head"><div><h2>إيقاف مؤقت</h2><div style="font-size:11.5px;color:var(--text-3);margin-top:3px">دورة المعاملة قصيرة (4–5 أيام عمل) — حد الإيقاف يوم عمل واحد</div></div><button class="modal-x" data-pause-cancel aria-label="إغلاق">✕</button></div>'+
      '<div class="modal-body">'+
        '<label class="tf-lbl">سبب الإيقاف *</label><textarea id="pauseReason" rows="2" placeholder="مثال: بانتظار رد الدائرة…" style="'+INP_STYLE+';width:100%;resize:vertical"></textarea>'+
        '<div style="font-size:11.5px;color:var(--text-3);margin-top:9px">بعد تجاوز يوم عمل تُرسَل تذكيرات يومية للمنشئ والمنفّذ حتى الاستئناف أو الإغلاق.</div>'+
      '</div>'+
      '<div class="modal-foot"><button class="btn-ghost" data-pause-cancel>إلغاء</button><button class="primary" data-pause-apply>إيقاف المهمة</button></div>'+
    '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){
      if(e.target===ov||e.target.closest('[data-pause-cancel]')){ removePauseModal(); return; }
      if(e.target.closest('[data-pause-apply]')){
        var rr=(document.getElementById('pauseReason').value||'').trim();
        if(!rr){ var n=document.getElementById('pauseReason'); n.style.borderColor='#c0553d'; n.focus(); return; }
        t.prevStatus=t.status; t.status='paused'; t.pausedAt=taskLive(); t.pauseReason=rr;
        addComment(id,'system','⏸ إيقاف مؤقت — السبب: '+rr,[],'update');
        removePauseModal(); updateTaskBadge();
        if(!document.getElementById('view-tasks').hidden) renderTasks(); else renderTaskDetail(id);
      }
    });
    setTimeout(function(){ var n=document.getElementById('pauseReason'); if(n) n.focus(); },40);
  }