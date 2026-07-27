function taskAction(a,id){
    var t=TASKS.find(function(x){ return x.id===id; }); if(!t) return;
    if(a==='detail'||a==='letter'){ renderTaskDetail(id); return; }
    if(a==='cancel'){ openCloseModal(id,'cancelled'); return; }
    else if(a==='pause'){ openPauseModal(id); return; }
    else if(a==='resume'){ t.status=t.prevStatus||'in_progress'; t.pausedAt=null; addComment(id,'system','▶ تم استئناف المهمة.',[],'update'); }
    else if(a==='ack'){ t.ack=taskLive(); addComment(id,'system','✓ أكد المنفّذ «'+asgName(t.assignee)+'» استلام المهمة والبدء في التنفيذ.',[],'update'); }
    updateTaskBadge();
    if(!document.getElementById('view-tasks').hidden) renderTasks();
    else renderTaskDetail(id);
  }