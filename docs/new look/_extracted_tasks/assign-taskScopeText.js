function taskScopeText(t){
    if(t.scope==='transaction') return 'صك '+((t.deeds&&t.deeds[0])||'—');
    if(t.scope==='work_order') return t.po||'—';
    if(t.scope==='multi') return (t.deeds?t.deeds.length:0)+' صكوك';
    return 'غير مرتبطة';
  }