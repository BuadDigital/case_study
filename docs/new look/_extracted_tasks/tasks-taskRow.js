function taskRow(t){
    var st=TASK_STATUS[t.status], ty=TASK_TYPES[t.type], pr=TASK_PRIORITY[t.priority]||TASK_PRIORITY.medium;
    var overdue=!TASK_TERMINAL[t.status] && t.dueAt < taskLive();
    var cols='40px minmax(170px,1.8fr) minmax(110px,1.1fr) minmax(120px,1.1fr) minmax(120px,1.2fr) minmax(84px,.85fr) 84px';
    var check=taskActive(t)?'<label class="tk-check" onclick="event.stopPropagation()"><input type="checkbox" data-tk-sel="'+esc(t.id)+'"'+(TASK_SEL[t.id]?' checked':'')+'></label>':'';
    var quickRemind=taskActive(t)?'<button class="remind-mini" data-remind="'+esc(t.id)+'" title="تذكير المنفّذ" aria-label="تذكير"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></button>':'';
    var cd=taskCountdown(t), u=taskUrgency(t);
    var dueCell = !taskActive(t)
      ? '<div class="td"><span class="date">'+(t.status==='paused'?'متوقفة':'—')+'</span></div>'
      : '<div class="td"><div class="cd-wrap"><span class="cd-dot'+(u.pulse?' live':'')+'" style="background:'+u.c+'"></span><span class="due-cd" data-cd="'+esc(t.id)+'" style="font-size:12.5px;font-weight:700;'+(cd.over?'color:#d9694f':'color:var(--heading)')+'">'+cd.txt+'</span><span class="cd-tip">الاستحقاق: '+esc(taskDueLabel(t.dueAt))+'</span></div></div>';
    return '<div class="row" data-task-open="'+esc(t.id)+'" style="grid-template-columns:'+cols+';cursor:pointer">'+
      '<div class="td c" onclick="event.stopPropagation()">'+check+'</div>'+
      '<div class="td"><div style="display:flex;align-items:center;gap:11px"><span style="width:30px;height:30px;border-radius:8px;flex:none;display:grid;place-items:center;background:var(--gold-soft);color:var(--gold-d)">'+typeIco(t.type,15)+'</span><div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-weight:700;color:var(--heading);font-size:13.5px">'+esc(t.title)+'</span><span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-3);font-size:11.5px"><span dir="ltr">'+esc(t.id)+'</span><span>·</span><span>'+esc(ty.label)+'</span><span>·</span><span style="display:inline-flex;align-items:center;gap:4px;color:'+pr.c+';font-weight:700"><span style="width:6px;height:6px;border-radius:50%;background:'+pr.c+'"></span>'+pr.t+'</span></span></div></div></div>'+
      '<div class="td"><div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:13px;font-weight:600;color:var(--text)">'+esc(TASK_SCOPES[t.scope])+'</span><span dir="ltr" style="font-size:11.5px;color:var(--text-3)">'+esc(taskScopeText(t))+'</span></div></div>'+
      '<div class="td"><div style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:600;color:var(--heading);font-size:13px">'+esc(asgName(t.assignee))+'</span><span style="color:var(--text-3);font-size:11.5px">'+esc(asgRole(t.assignee))+'</span></div></div>'+
      dueCell+
      '<div class="td">'+pill(st.t,st.c)+'</div>'+
      '<div class="td"><div style="display:flex;align-items:center;gap:2px;justify-content:center;width:100%">'+quickRemind+taskKebab(t)+'</div></div>'+
    '</div>';
  }