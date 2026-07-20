function pill(t, c){ return '<span class="status" style="background:color-mix(in srgb,' + c + ' 15%,transparent);color:' + c + '"><span class="sd" style="background:' + c + '"></span>' + esc(t) + '</span>'; }
  var GOLD = 'var(--gold)', NAVY = 'var(--ink)', GREEN = '#3f8f5f', AMBER = '#d9a441', RED = '#d9694f', GRAY = '#8a8d96';
  var STAT_ACC = [['gold','var(--gold)','var(--gold-d)'],['','#d9a441','#8a5e14'],['','var(--ink)','var(--ink)'],['','#3f8f5f','#2f7a4d']];
  var STAT_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></svg>';
  function statCard(s, i){
    var a = STAT_ACC[i % 4], first = i === 0;
    var icoStyle = fir