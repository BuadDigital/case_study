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

  /* ═══════════ KEY ENVELOPES (محفظة المفاتيح) ═══════════ */
  var KEY_STATE = { search:'', scenario:'all', status:'all', showOut:false };
  var KEY_ENV = [
    { id:'e1', request:'ENF-2026-4471', court:'محكمة التنفيذ بجدة', circuit:'الدائرة الثالثة',
      labeled:5, actual:5, scenario:'court', status:'assessor', fee:true, feeAmount:350, created:'12/07/2026', contact:'',
      attachments:[{k:'receipt'},{k:'photo'}],
      assignments:[
        {deed:'310204009812', property:'فيلا — حي الصفا', status:'matched', note:'فُتح الباب بنجاح'},
        {deed:'310204009845', property:'شقة — حي السلامة', status:'pending', note:'بانتظار التجربة الميدانية'},
        {deed:'310204009999', property:'مستودع — حي البوادي', status:'unmatched', note:'المفتاح لا يطابق القفل'} ],
      handoffs:[ {type:'internal', state:'confirmed', person:'أيمن مجرشي', role:'معاين ميداني', date:'14/07/2026', letter:''} ],
      timeline:[
        {ev:'created', date:'12/07/2026 09:14', detail:'تسجيل الظرف برقم الطلب ENF-2026-4471 — الحالة: بعهدة المراجع'},
        {ev:'fee', date:'12/07/2026 09:15', detail:'توليد بند أتعاب استلام مفاتيح (350 ر.س) مرتبط بصورة الظرف وخطاب الاستلام'},
        {ev:'assign', date:'12/07/2026 09:22', detail:'إضافة إسناد مبدئي لثلاثة صكوك'},
        {ev:'handoff', date:'14/07/2026 11:03', detail:'تسليم داخلي للمعاين أيمن مجرشي وتأكيده — الحالة: بعهدة المعاين'},
        {ev:'confirm', date:'16/07/2026 13:40', detail:'تأكيد ميداني: صك 310204009812 مطابق، وصك 310204009999 غير مطابق'} ] },
    { id:'e2', request:'ENF-2026-4460', court:'محكمة التنفيذ بمكة المكرمة', circuit:'الدائرة الأولى',
      labeled:2, actual:2, scenario:'court', status:'reviewer', fee:tru