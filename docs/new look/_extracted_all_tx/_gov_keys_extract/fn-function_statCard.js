function statCard(s, i){
    var a = STAT_ACC[i % 4], first = i === 0;
    var icoStyle = first ? '' : ' style="background:color-mix(in srgb,' + a[1] + ' 15%,transparent);color:' + a[2] + '"';
    return '<div' + (first ? ' class="first"' : '') + '><div class="kpi-head"><span class="kpi-ico' + (first ? ' gold' : '') + '"' + icoStyle + '>' + STAT_ICON + '</span><span>' + esc(s[1]) + '</span></div><div class="kpi-num">' + esc(String(s[0])) + '</div><div class="kpi-sub">' + esc(s[2] || '') + '</div></div>';
  }
  function renderList(label, cfg){
    var cols = cfg.cols.map(function(c){ return c.w || (c.first ? 'minmax(160px,1.5fr)' : 'minmax(110px,1fr)'); }).join(' ');
    var head = cfg.cols.map(function(c){ return '<div class="th' + (c.center ? ' c' : '') + '">' + esc(c.label) + '</div>'; }).join('');
    var body = cfg.rows.map(function(r){
      return '<div class="row" style="grid-template-columns:' + cols + '">' + r.map(function(cell, i){
        return '<div class="td' + (cfg.cols[i].center ? ' c' : '') + '">' + cell + '</div>';
      }).join('') + '</div>';
    }).join('');
    var stats = cfg.stats.map(statCard).join('');
    document.getElementById('view-generic').innerHTML =
      '<div class="kpi">' + stats + '</div>' +
      '<div class="toolbar"><div class="filters" style="flex:1">' +
        '<div class="search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="text" placeholder="بحث…" oninput="(function(inp){var q=inp.value.trim();inp.closest(\'.view\').querySelectorAll(\'#glRows .row\').forEach(function(r){r.style.display=(!q||r.textContent.indexOf(q)!==-1)?\'\':\'none\';});})(this)" /></div>' +
        (cfg.action ? '<button class="primary" style="margin-inline-start:auto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg><span>' + esc(cfg.action) + '</span></button>' : '') +
      '</div></div>' +
      '<div class="card"><div class="scroll"><div class="grid" style="min-width:100%"><div class="thead" style="grid-template-columns:' + cols + '">' + head + '</div><div id="glRows">' + body + '</div></div></div></div>';
    setHeader(label, crumb(['لوحة التحكم', label]));
    navActive(label); showView('generic');
  }

  /* ── جميع المعاملات (مط