function openPriorityModal(id){
    var t=TASKS.find(function(x){ return x.id===id; }); if(!t) return;
    var dd=new Date(t.dueAt);
    PMODAL={ id:id, priority:t.priority, editDue:false, date:isoFromTs(t.dueAt), time:pad2(dd.getHours())+':'+pad2(dd.getMinutes()) };
    removePriorityModal();
    var segs=['high','medium','low'].map(function(k){ return '<button type="button" class="tf-seg" data-pmodal-prio="'+k+'">'+TASK_PRIORITY[k].t+'</button>'; }).join('');
    var ov=document.createElement('div'); ov.id='prioModalOverlay'; ov.className='modal-overlay';
    ov.innerHTML='<div class="modal" role="dialog" aria-modal="true" style="max-width:480px">'+
      '<div class="modal-head"><div><h2>تغيير الأولوية</h2><div style="font-size:11.5px;color:var(--text-3);margin-top:3px">طرأ ما يستعجل الإنجاز؟ صعّد الأولوية — يُحدَّث تواتر التذكير تلقائياً</div></div><button class="modal-x" data-pmodal-cancel aria-label="إغلاق">✕</button></div>'+
      '<div class="modal-body">'+
        '<div style="font-size:12.5px;color:var(--text-2);margin-bottom:10px">الأولوية الحالية: <b style="color:'+(TASK_PRIORITY[t.priority]||TASK_PRIORITY.medium).c+'">'+(TASK_PRIORITY[t.priority]||TASK_PRIORITY.medium).t+'</b></div>'+
        '<label class="tf-lbl">الأولوية الجديدة</label><div class="tf-seg-row" id="pmodalSeg">'+segs+'</div>'+
        '<div style="font-size:11.5px;color:var(--text-3);margin-top:9px" id="pmodalHint"></div>'+
        '<label style="display:flex;align-items:center;gap:9px;margin-top:16px;font-size:12.5px;color:var(--text-2);cursor:pointer"><input type="checkbox" id="pmodalEditDue" style="width:16px;height:16px;accent-color:var(--gold-d);flex:none"><span>تعديل موعد الاستحقاق</span></label>'+
        '<div id="pmodalDueBox" hidden style="margin-top:12px">'+
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button type="button" class="tf-chip" data-pmodal-fitprio>ضبط حسب الأولوية الجديدة</button></div>'+
          '<div style="display:flex;gap:10px;flex-wrap:wrap"><input id="pmodalDate" type="date" value="'+PMODAL.date+'" style="'+INP_STYLE+';max-width:180px"><input id="pmodalTime" type="time" value="'+PMODAL.time+'" style="'+INP_STYLE+';max-width:140px"></div>'+
        '</div>'+
      '</div>'+
      '<div class="modal-foot"><button class="btn-ghost" data-pmodal-cancel>إلغاء</button><button class="primary" data-pmodal-apply><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span>تطبيق</span></button></div>'+
    '</div>';
    document.body.appendChild(ov);
    document.querySelectorAll('#pmodalSeg .tf-seg').forEach(function(b){ b.addEventListener('click', function(){ PMODAL.priority=b.getAttribute('data-pmodal-prio'); syncPmodal(); }); });
    document.getElementById('pmodalEditDue').addEventListener('change', function(e){ PMODAL.editDue=e.target.checked; document.getElementById('pmodalDueBox').hidden=!e.target.checked; });
    document.querySelector('[data-pmodal-fitprio]').addEventListener('click', function(){ var due=taskLive()+(TASK_PRIORITY[PMODAL.priority]||TASK_PRIORITY.medium).off, d=new Date(due); PMODAL.date=isoFromTs(due); PMODAL.time=pad2(d.getHours())+':'+pad2(d.getMinutes()); document.getElementById('pmodalDate').value=PMODAL.date; document.getElementById('pmodalTime').value=PMODAL.time; });
    document.getElementById('pmodalDate').addEventListener('change', function(e){ PMODAL.date=e.target.value; });
    document.getElementById('pmodalTime').addEventListener('change', function(e){ PMODAL.time=e.target.value; });
    syncPmodal();
  }