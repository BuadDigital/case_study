function keyTimeline(items){
    return '<div style="position:relative;padding-inline-start:24px">'+
      '<div style="position:absolute;inset-inline-start:5px;top:6px;bottom:8px;width:2px;background:var(--border-2)"></div>'+
      items.map(function(t){
        return '<div style="position:relative;padding-bottom:18px">'+
          '<div style="position:absolute;inset-inline-start:-24px;top:2px;width:12px;height:12px;border-radius:50%;background:'+t.c+';border:2px solid var(--surface);box-shadow:0 0 0 2px color-mix(in srgb,'+t.c+' 25%,transparent)"></div>'+
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:13.5px;font-weight:700;color:var(--heading)">'+esc(t.title)+'</span><span style="font-size:12px;color:var(--text-3);direction:ltr">'+esc(t.date)+'</span></div>'+
          '<div style="font-size:12.5px;color:var(--text-2);margin-top:3px;line-height:1.65">'+esc(t.detail)+'</div>'+
          (t.person?'<div style="display:inline-flex;align-items:center;gap:8px;margin-top:9px;padding:4px 12px 4px 5px;border-radius:99px;background:var(--surface-2);border:1px solid var(--border-2)"><span style="width:24px;height:24px;border-radius:6px;display:grid;place-items:center;background:var(--ink);color:var(--gold-2);font-weight:700;font-size:11px">'+esc(t.person.charAt(0))+'</span><span style="font-size:12.5px;font-weight:700;color:var(--heading)">'+esc(t.person)+'</span>'+(t.role?'<span style="font-size:11px;color:var(--text-3)">'+esc(t.role)+'</span>':'')+'</div>':'')+
        '</div>';
      }).join('')+'</div>';
  }
