._env;
      var gate = hasEnv
        ? '<span class="status" style="background:color-mix(in srgb,#2f7a4d 15%,transparent);color:#2f7a4d"><span class="sd" style="background:#2f7a4d"></span>ظرف مسجّل</span>'
        : ks==='received'
          ? '<span class="status" style="background:color-mix(in srgb,#d9a441 18%,transparent);color:#8a5e14"><span class="sd live" style="background:#d9a441"></span>بانتظار الظرف</span>'
          : '<span class="muted">—</span>';
      var act = p._govReviewed
        ? '<span class="status" style="background:color-mix(in srgb,#2f7a4d 15%,transparent);color:#2f7a4d"><span class="sd" style="background:#2f7a4d"></span>منتهية</span>'
        : (hasEnv?'':'<button class="ghost-btn" data-gov-reg="'+i+'" style="height:30px;padding:0 11px;font-size:12px;color:var(-