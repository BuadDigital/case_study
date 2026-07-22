function renderGeneric(label){
    document.getElementById('view-generic').innerHTML =
      '<div class="generic-empty"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg><div style="font-size:15px;font-weight:700;color:var(--text-2)">' + esc(label) + '</div><div style="font-size:13px">هذه الشاشة ضمن النظام — جاهزة للبناء بنفس التصميم عند الطلب.</div></div>';
    setHeader(label, crumb(['لوحة التحكم', label]));
    navActive(label);
    showView('generic');
  }

  /* ── generic list-screen builder (نفس تصميم أوامر العمل) ── */
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
