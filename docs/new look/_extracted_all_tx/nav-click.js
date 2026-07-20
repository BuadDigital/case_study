querySelectorAll('.nav-item').forEach(function(n){
    var s = n.querySelector('span'); if (!s) return;
    var label = s.textContent.trim();
    n.addEventListener('click', function(){
      if (label === 'أوامر العمل (PO)') goPoList();
      else if (label === 'لوحة التحكم') renderDashboard();
      else if (label === 'مؤشرات الأداء') renderKpi();
      else if (label === 'التقارير المالية') renderFinancial();
      else if (label === 'جميع المعاملات') renderAllTransactions();
      else if (PAGES[label]) renderList(label, PAGES[label]);
      else renderGeneric(label);
    });
  });

  // delegated navigation for links / rows
  document.addEventListener('click', function(e){
    if (e.target.closest('.kebab')) return;
    var reopen = e.target.closest('[data-reopen]');
    if (reopen){ document.querySelectorAll('.actions.open').forEach(function(x){ x.classList.remove('open'); }); openReopenModal(reopen.getAttribute('data-po'), reopen.getAttribute('data-reopen')); return; }
    var openPo = e.target.closest('[data-open-po]');
    if (openPo){ document.querySelectorAll('.actions.open').forEach(function(x){ x.classList.remove('open'); }); renderProperties(openPo.getAttribute('data-open-po')); return; }
    var poLink = e.target.closest('a.po[data-po]');
    if (poLink){ e.preventDefault(); renderProperties(poLink.getAttribute('data-po')); return; }
    var propRow = e.target.closest('[data-prop]');
    if (propRow){ renderProperty(propRow.getAttribute('data-po'), propRow.getAttribute('data-prop')); return; }
    var backProps = e.target.closest('[data-back-props]');
    if (backProps){ renderProperties(backProps.getAttribute('data-back-props')); return; }
    if (e.target.closest('[data-nav-po]')){ goPoList(); return; }
  });

  /* ═══════════ PO intake modal ═══════════ */
  var ov = document.getElementById('intakeOverlay');
  var F = { po:'f_po', date:'f_date', spec:'f_spec', email:'f_email', type:'f_type', count:'f_count', region:'f_region', desc:'f_desc' };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function val(k){ return document.getElementById(F[k]).value.trim(); }
  function clearErrs(){
    document.getElementById('intakeError').hidden = true;
    document.querySelectorAll('#intakeOverlay .fld').forEach(function(f){ f.classList.remove('err'); var m=f.querySelector('.msg'); if(m) m.textContent=''; });
  }
  function setErr(k, msg){
    var f = document.querySelector('#intakeOverlay .fld[data-f="'+k+'"]');
    if (f){ f.classList.add('err'); var m=f.querySelector('.msg'); if(m) m.textContent=msg; }
  }
  function openIntake(){
    clearErrs();
    Object.keys(F).forEach(function(k){ var el=document.getElementById(F[k]); if(el) el.value = (k==='count'?'1':''); });
    ov.hidden = false;
    setTimeout(function(){ document.getElementById('f_po').focus(); }, 40);
  }
  function closeIntake(){ ov.hidden = true; }
  function toDDMM(iso){ var p=iso.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
  function addBiz(iso, n){
    var p=iso.split('-'), c=new Date(+p[0], +p[1]-1, +p[2]);
    while(n>0){ c.setDate(c.getDate()+1); var g=c.getDay(); if(g>=0&&g<=4) n--; }
    var dd=String(c.getDate()).padStart(2,'0'), mm=String(c.getMonth()+1).padStart(2,'0');
    return dd+'/'+mm+'/'+c.getFullYear();
  }
  function saveIntake(){
    clearErrs();
    var po=val('po'), date=val('date'), type=val('type'), email=val('email'), countRaw=val('count');
    var count=parseInt(countRaw,10);
    var errs=[];
    if(!po){ setErr('po','رقم PO مطلوب'); errs.push(1); }
    else if(ORDERS.some(function(o){ return o.po.toLowerCase()===po.toLowerCase(); })){ setErr('po','رقم PO مسجّل مسبقاً'); errs.push(1); }
    if(!date){ setErr('date','تاريخ التعميد مطلوب'); errs.push(1); }
    if(!type){ setErr('type','نوع الإسناد مطلوب'); errs.push(1); }
    if(!Number.isFinite(count)||count<1){ setErr('count','١ على الأقل'); errs.push(1); }
    if(email && !EMAIL_RE.test(email)){ setErr('email','صيغة الإيميل غير صالحة'); errs.push(1); }
    if(errs.length){ var e=document.getElementById('intakeError'); e.textContent='يرجى تصحيح الحقول المشار إليها.'; e.hidden=false; return; }
    var received=toDDMM(date), due=addBiz(date,4);
    var rec={ po:po, type:type, count:count, registered:0, done:0, status:'جديد', received:received, due:due, specialist:val('spec') };
    rec.recTs=toTs(received); rec.dueTs=toTs(due);
    ORDERS.unshift(rec);
    render(); refreshStats();
    closeIntake();
    renderProperties(po);
  }
  function refreshStats(){
    var pc=ORDERS.reduce(function(n,o){ return n+o.count; },0);
    var db=ORDERS.filter(function(o){ return o.status==='مكتمل'||o.status==='مفوتر بالكامل'||o.status==='مفوتر جزئي'; }).length;
    setKpi('kpiTotal', ORDERS.length); setKpi('kpiProps', pc);
    setKpi('kpiAvg', ORDERS.length?(pc/ORDERS.length).toFixed(1):'0'); setKpi('kpiDone', db);
    var s=document.getElementById('kpiDoneSub'); if(s) s.textContent='من '+ORDERS.length+' إجمالي';
  }
  document.addEventListener('click', function(e){
    if(e.target.closest('#view-po .primary')){ openIntake(); return; }
    if(e.target.closest('#intakeClose')||e.target.closest('#intakeCancel')){ closeIntake(); return; }
    if(e.target.closest('#intakeSave')){ saveIntake(); return; }
    if(e.target===ov){ closeIntake(); return; }
  });
})();
</script>
<template id="__bundler_thumbnail" data-bg-color="#102B4E">
  <svg viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="800" fill="#102B4E"/>
    <g fill="none" stroke="#a4906f" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">
      <rect x="470" y="250" width="180" height="90" rx="16"/>
      <path d="M650 295h55a45 45 0 0 1 45 45v205a45 45 0 0 1-45 45H430a45 45 0 0 1-45-45V340a45 45 0 0 1 45-45h55"/>
      <path d="M470 415h270M470 480h270"/>
    </g>
  </svg>
</template>
</body>
</html>
