function keyDrawList(){
    var rows=keyFiltered();
    var COLS='minmax(105px,.9fr) minmax(150px,1.4fr) 92px minmax(110px,1fr) 72px minmax(118px,1fr) minmax(120px,1fr) 44px';
    var body=rows.map(function(e){
      var sc=keyScen(e.scenario), st=keyStat(e.status), mm=e.actual!==e.labeled;
      var out=e.status==='returned'||e.status==='external';
      return '<div class="row" data-key-open="'+esc(e.id)+'" style="cursor:pointer;grid-template-columns:'+COLS+(out?';opacity:.55;filter:saturate(.6)':'')+'">'+
        '<div class="td"><span class="po">'+esc(keyRef(e))+'</span></div>'+
        '<div class="td" style="flex-direction:column;align-items:flex-start;gap:2px"><span class="spec-name">'+esc(e.court)+'</span><span style="font-size:11px;color:var(--text-3)">'+esc(e.circuit)+'</span></div>'+
        '<div class="td c"><span class="num">'+e.actual+'</span>'+(mm?'<span title="تعارض في العدد" style="display:inline-grid;place-items:center;width:18px;height:18px;border-radius:99px;margin-inline-start:6px;background:color-mix(in srgb,#d9694f 15%,transparent);color:#c0553d"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg></span>':'')+'</div>'+
        '<div class="td" style="font-weight:600;color:var(--text-2)">'+esc(e.request)+'</div>'+
        '<div class="td c"><span class="num-2">'+e.assignments.length+'</span></div>'+
        '<div class="td">'+keyPill(sc[1],sc[0])+'</div>'+
        '<div class="td">'+keyPill(st[1],st[0])+'</div>'+
        '<div class="td c" style="color:var(--text-3)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></div>'+
      '</div>';
    }).join('');
    var el=document.getElementById('keyRows'); if(!el) return;
    el.innerHTML = rows.length? body : '<div class="empty"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><div class="t">لا توجد ظروف مطابقة</div><div class="s">جرّب تعديل البحث أو الفلاتر</div></div>';
    var ch=document.getElementById('keyChip'); if(ch) ch.textContent=rows.length+' نتيجة';
  }