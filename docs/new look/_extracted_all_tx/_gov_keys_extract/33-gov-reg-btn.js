>'
          : '<span class="muted">—</span>';
      var act = p._govReviewed
        ? '<span class="status" style="background:color-mix(in srgb,#2f7a4d 15%,transparent);color:#2f7a4d"><span class="sd" style="background:#2f7a4d"></span>منتهية</span>'
        : (hasEnv?'':'<button class="ghost-btn" data-gov-reg="'+i+'" style="height:30px;padding:0 11px;font-size:12px;color:var(--gold-d)">تسجيل ظرف</button>')+
          '<button class="ghost-btn" data-gov-done="'+i+'" style="height:30px;padding:0 11px;font-size:12px;color:#2f7a4d">إنهاء المراجعة</button>';
      return '<div class="row" style="grid-template-columns:'+GCOLS+';min-height:56px">'+
        '<div class="td"><span class="po" data-prop="'+esc(p.id)+'" data-po="'+esc(o.po)+'">'+esc(p.deed)+'</span></div>'+
        '<div class="td muted">'+esc(p.city+' · '+p.district)+'</div>'+
        '<div class="td" style="flex-direction:column;align-items:flex-start;gap:2px"><span style="font-size:12.5px;font-weight:600;color:var(--heading)">'+esc(p.court)+'</span><span style="font-size:11px;color:var(--text-3)">طلب '+esc(p.request)+' · '+