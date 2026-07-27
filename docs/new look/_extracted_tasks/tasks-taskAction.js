function taskAction(a,id){
    var t=TASKS.find(function(x){ return x.id===id; }); if(!t) return;
    if(a==='detail'||a==='letter'){ renderTaskDetail(id); return; }
    if(a==='start') t.status='in_progress';
    else if(a==='complete') t.status='completed';
    else if(a==='cancel') t.status='cancelled';
    else if(a==='pause'){ t.prevStatus=t.status; t.status='paused'; addComment(id,'system','⏸ تم إيقاف المهمة مؤقتاً.',[],'update'); }
    else if(a==='resume'){ t.status=t.prevStatus||'in_progress'; addComment(id,'system','▶ تم استئناف المهمة.',[],'update'); }
    updateTaskBadge();
    if(!document.getElementById('view-tasks').hidden) renderTasks();
    else renderTaskDetail(id);
  }