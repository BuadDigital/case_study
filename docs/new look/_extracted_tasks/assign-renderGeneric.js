function renderGeneric(label){
    document.getElementById('view-generic').innerHTML =
      '<div class="generic-empty"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg><div style="font-size:15px;font-weight:700;color:var(--text-2)">' + esc(label) + '</div><div style="font-size:13px">هذه الشاشة ضمن النظام — جاهزة للبناء بنفس التصميم عند الطلب.</div></div>';
    setHeader(label, crumb(['لوحة التحكم', label]));
    navActive(label);
    showView('generic');
  }