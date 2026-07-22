function pill(t, c){ return '<span class="status" style="background:color-mix(in srgb,' + c + ' 15%,transparent);color:' + c + '"><span class="sd" style="background:' + c + '"></span>' + esc(t) + '</span>'; }
  var GOLD = 'var(--gold)', NAVY = 'var(--ink)', GREEN = '#3f8f5f', AMBER = '#d9a441', RED = '#d9694f', GRAY = '#8a8d96';
  var STAT_ACC = [['gold','var(--gold)','var(--gold-d)'],['','#d9a441','#8a5e14'],['','var(--ink)','var(--ink)'],['','#3f8f5f','#2f7a4d']];
  var STAT_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></svg>';
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
        '<div class="search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="text" placeholder="بحث…" oninput="(function(inp){var q=inp.value.trim();inp.closest(\'.view\').querySelectorAll(\'#glRows .row\').forEach(function(r){r.style.display=(!q||r.textContent.indexOf(q)!==-1)?\'\':\'none\';});})(t