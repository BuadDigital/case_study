var TX_STATE = { search:'', status:'', type:'', group:false, collapsed:{} };
  function txMoreMenu(){
    return '<div class="actions"><button class="kebab" aria-label="خيارات المعاملة"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button>' +
      '<div class="act-pop">' +
        '<div class="act-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span>فتح المعاملة</span></div>' +
        '<div class="act-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><span>سجل المراحل</span></div>' +
        '<div class="act-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z" opacity="0"/><path d="M6 3h9l5 5v13H6z"/><path d="M14 3v5h5"/></svg><span>عرض بيانات العقار</span></div>' +
      '</div></div>';
  }
  function renderAllTransactions(){
    var phases = ALL_TX.map(function(t){ return t.phase; }).filter(function(v,i,a){ return a.indexOf(v)===i; });
    var types  = ALL_TX.map(function(t){ return t.type; }).filter(function(v,i,a){ return a.indexOf(v)===i; });
    var opt = function(v){ return '<option value="'+esc(v)+'">'+esc(v)+'</option>'; };
    var cols = 'minmax(118px,1.4fr) minmax(88px,1fr) minmax(80px,.9fr) minmax(84px,1fr) minmax(80px,.9fr) minmax(98px,1fr) 44px';
    document.getElementById('view-generic').innerHTML =
      '<div class="toolbar"><div class="filters" style="flex:1">' +
        '<div class="search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input id="txSearch" type="text" placeholder="رقم الصك أو نوع الإسناد أو المدينة…" /></div>' +
        '<div class="sel"><select id="txStatus"><option value="">جميع الحالات</option>' + phases.map(opt).join('') + '</select>' + CARET + '</div>' +
        '<div class="sel"><select id="txType"><option value="">جميع أنواع الإسناد</option>' + types.map(opt).join('') + '</select>' + CARET + '</div>' +
        '<button id="txGroup" type="button" style="display:inline-flex;align-items:center;gap:7px;padding:8px 13px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:12.5px;font-weight:700;cursor:pointer"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg><span>تجميع حسب أمر العمل</span></button>' +
        '<span id="txCount" style="margin-inline-start:auto;font-size:12.5px;color:var(--text-3);font-weight:600"></span>' +
      '</div></div>' +
      '<div class="card"><div class="scroll"><div class="grid" style="min-width:100%">' +
        '<div class="thead" style="grid-template-columns:' + cols + '">' +
          '<div class="th">رقم الصك</div><div class="th">أمر العمل</div><div class="th">نوع الإسناد</div><div class="th">المدينة</div><div class="th">الحي</div><div class="th">المرحلة</div><div class="th c">المزيد</div>' +
        '</div><div id="txRows"></div></div></div>' +
        '<div style="padding:11px 16px;border-top:1px solid var(--border);font-size:12px;color:var(--text-3)">اضغط الصف لفتح المعاملة في مرحلتها الحالية — اضغط نفس الصف مرة أخرى للإغلاق.</div>' +
      '</div>';
    var draw = function(){
      var q = TX_STATE.search.trim();
      var rows = ALL_TX.filter(function(t){
        var okQ = !q || (t.deed + ' ' + t.po + ' ' + t.type + ' ' + t.city + ' ' + t.district).indexOf(q) !== -1;
        var okS = !TX_STATE.status || t.phase === TX_STATE.status;
        var okT = !TX_STATE.type || t.type === TX_STATE.type;
        return okQ && okS && okT;
      });
      var rowHtml = function(t){
        return '<div class="row" data-open-po="' + esc(t.po) + '" style="grid-template-columns:' + cols + ';cursor:pointer">' +
          '<div class="td"><span dir="ltr" style="font-weight:700;color:var(--gold-d);font-size:12.5px">صك ' + esc(t.deed) + '</span></div>' +
          '<div class="td"><span dir="ltr" style="font-weight:600;color:var(--text-2);font-size:12.5px">' + esc(t.po) + '</span></div>' +
          '<div class="td">' + esc(t.type) + '</div>' +
          '<div class="td">' + esc(t.city) + '</div>' +
          '<div class="td">' + esc(t.district) + '</div>' +
          '<div class="td">' + pill(t.phase, t.pc) + '</div>' +
          '<div class="td c">' + txMoreMenu() + '</div>' +
        '</div>';
      };
      var html;
      if (!rows.length) {
        html = '<div style="padding:44px 16px;text-align:center;color:var(--text-3);font-size:13.5px">لا توجد معاملات مطابقة.</div>';
      } else if (TX_STATE.group) {
        var order = [], byPo = {};
        rows.forEach(function(t){ if (!byPo[t.po]) { byPo[t.po] = []; order.push(t.po); } byPo[t.po].push(t); });
        html = order.map(function(po){
          var grp = byPo[po], open = !TX_STATE.collapsed[po];
          var chev = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:transform .15s;transform:rotate(' + (open ? '0' : '-90') + 'deg)"><path d="m6 9 6 6 6-6"/></svg>';
          return '<div class="tx-grp-head" data-po-open="' + esc(po) + '" style="display:flex;align-items:center;gap:10px;padding:11px 16px;background:var(--surface-2);border-top:1px solid var(--border);cursor:pointer;user-select:none">' +
              '<span class="tx-grp-chev" data-po-grp="' + esc(po) + '" title="' + (open ? 'طي' : 'فتح') + '" style="color:var(--text-3);display:grid;place-items:center;cursor:pointer;padding:2px;border-radius:6px">' + chev + '</span>' +
              '<span dir="ltr" style="font-weight:800;color:var(--heading);font-size:13px">' + esc(po) + '</span>' +
              '<span style="background:var(--gold-soft);color:var(--gold-d);font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:99px">' + grp.length + ' معاملة</span>' +
              '<span style="margin-inline-start:auto;display:inline-flex;align-items:center;gap:5px;color:var(--gold-d);font-size:12px;font-weight:700">دخول أمر العمل<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></span>' +
            '</div>' +
            '<div style="display:' + (open ? 'block' : 'none') + '">' + grp.map(rowHtml).join('') + '</div>';
        }).join('');
      } else {
        html = rows.map(rowHtml).join('');
      }
      document.getElementById('txRows').innerHTML = html;
      document.getElementById('txCount').textContent = rows.length + ' نتيجة';
    };
    document.getElementById('txSearch').addEventListener('input', function(e){ TX_STATE.search = e.target.value; draw(); });
    document.getElementById('txStatus').addEventListener('change', function(e){ TX_STATE.status = e.target.value; draw(); });
    document.getElementById('txType').addEventListener('change', function(e){ TX_STATE.type = e.target.value; draw(); });
    document.getElementById('txGroup').addEventListener('click', function(){
      TX_STATE.group = !TX_STATE.group;
      if (TX_STATE.group) { TX_STATE.collapsed = {}; ALL_TX.forEach(function(t){ TX_STATE.collapsed[t.po] = true; }); }
      var on = TX_STATE.group;
      this.style.background = on ? 'var(--ink)' : 'var(--surface)';
      this.style.color = on ? '#fff' : 'var(--text-2)';
      this.style.borderColor = on ? 'var(--ink)' : 'var(--border-2)';
      draw();
    });
    document.getElementById('txRows').addEventListener('click', function(e){
      var chev = e.target.closest('[data-po-grp]');
      if (chev) { e.stopPropagation(); var p = chev.getAttribute('data-po-grp'); TX_STATE.collapsed[p] = !TX_STATE.collapsed[p]; draw(); return; }
      var head = e.target.closest('[data-po-open]');
      if (head) { renderProperties(head.getAttribute('data-po-open')); }
    });
    draw();
    setHeader('جميع المعاملات', crumb(['لوحة التحكم','جميع المعاملات']));
    navActive('جميع المعاملات'); showView('generic');
  }

  var PAGES = {
    'المعاملات النشطة': { stats:[[41,'معاملات نشطة','قيد المعالجة'],[9,'استعلام بورصة',''],[12,'التوزيع',''],[20,'دراسة الحالة','']],
      cols:[{label:'رقم المعاملة',first:true},{label:'العقار / الصك'},{label:'المرحلة'},{label:'المتبقي'},{label:'الحالة'},{label:'الأخصائي'}],
      rows:[
        ['TX-5012','صك 10203040506','دراسة الحالة','يومان',pill('قيد العمل',GOLD),'أسامة الصالحي'],
        ['TX-5011','صك 88120044991','المراجعة الحكومية','٣ أيام',pill('قيد العمل',GOLD),'عبدالله الكثيري'],
        ['TX-5009','صك 45500213366','البورصة','متأخر',pill('متعذر',RED),'تركي'],
        ['TX-5006','صك 90011223344','التوزيع','١ يوم',pill('قيد العمل',GOLD),'عمر'],
        ['TX-5001','صك 55667788990','دراسة الحالة','٤ أيام',pill('قيد العمل',GOLD),'عثمان']
      ] },
    'مكاتب الرفع الهندسي': { stats:[[16,'إجمالي طلبات الرفع',''],[9,'مكتملة',''],[5,'قيد التنفيذ',''],[2,'لم تُسند','']],
      cols:[{label:'اسم المكتب',first:true},{label:'نشطة',center:true},{label:'مكتملة هذا الشهر',center:true},{label:'متوسط الإنجاز',center:true},{label:'آلية التعاقد'},{label:'الحالة'}],
      rows:[
        ['مكتب جدة للمساحة','5','12','2.8 يوم',pill('عقد سنوي',GRAY),pill('نشط',GREEN)],
        ['مكتب مكة الهندسي','4','9','3.1 يوم',pill('عقد سنوي',GRAY),pill('نشط',GREEN)],
        ['مكتب الرياض للرفع','3','7','3.9 يوم',pill('بالطلب',GRAY),pill('مشغول',AMBER)],
        ['مكتب الطائف','2','4','4.2 يوم',pill('بالطلب',GRAY),pill('نشط',GREEN)],
        ['مكتب الدمام','0','3','—',pill('عقد سنوي',GRAY),pill('نشط',GREEN)]
      ] },
    'إدارة المفاتيح': { stats:[[27,'إجمالي المفاتيح',''],[18,'مستلمة',''],[6,'بانتظار الاستلام',''],[3,'تعذرات مفاتيح','']],
      cols:[{label:'الصك',first:true},{label:'حالة الصك'},{label:'المنطقة'},{label:'المحكمة'},{label:'حالة المفتاح'},{label:'تعذر المفتاح'},{label:'المندوب'},{label:'إجراء'}],
      rows:[
        ['صك 10203040506',pill('فعال',GREEN),'العزيزية','محكمة التنفيذ بمكة',pill('مستلم',GREEN),pill('لا يوجد',GRAY),'عبدالله عبدالمانع','—'],
        ['صك 88120044991',pill('قيد التحقق',AMBER),'الشرفية','محكمة التنفيذ بجدة',pill('بانتظار الاستلام',AMBER),pill('لا يوجد',GRAY),'—','<button class="btn-ghost" style="padding:5px 12px;font-size:12px">تسجيل الاستلام</button>'],
        ['صك 45500213366',pill('موقوف',RED),'النسيم','محكمة التنفيذ بالرياض',pill('بانتظار الاستلام',AMBER),pill('متعذر',RED),'—','<button class="btn-ghost" style="padding:5px 12px;font-size:12px">تسجيل الاستلام</button>'],
        ['صك 77341122008',pill('فعال',GREEN),'السلامة','محكمة التنفيذ بجدة',pill('مستلم',GREEN),pill('سابق',AMBER),'المكتب الهندسي','—']
      ] },
    'إدارة التعذرات': { stats:[[3,'تعذرات مفتوحة','تحتاج معالجة'],[2,'عند مشرف دراسة الحالة','بانتظار الاعتماد'],[12,'معتمدة / تم الحل','80% من الإجمالي'],[20,'الإجمالي','سجلات التعذر']],
      cols:[{label:'الصك',first:true},{label:'أمر العمل'},{label:'الخطورة'},{label:'الحالة'},{label:'الرافع'},{label:'الأخصائي'}],
      rows:[
        ['صك 45500213366','PO-2026-0005','مؤكد',pill('مفتوح',RED),'معاين ميداني','تركي'],
        ['صك 33445566778','PO-2026-0010','مؤكد',pill('مراجعة',AMBER),'مراجع حكومي','عثمان'],
        ['صك 90011223344','PO-2026-0011','احتمال',pill('داخلي',NAVY),'مقيم عقاري','عمر'],
        ['صك 55667788990','PO-004','مؤكد',pill('معتمد',GREEN),'أخصائي دراسة','أيمن مجرشي'],
        ['صك 12009887654','PO-002','احتمال',pill('تم الحل',GREEN),'أخصائي دراسة','—']
      ] },
    'المعاملات المعلقة': { stats:[[4,'معاملات معلقة','بانتظار رفع التعليق'],[1,'متأخرة عن الاستحقاق','تجاوزت الموعد'],[3,'ضمن المهلة','75% من الإجمالي'],[4,'الإجمالي','عقارات موقوفة مؤقتاً']],
      cols:[{label:'رقم الصك',first:true},{label:'أمر العمل'},{label:'نوع الإسناد'},{label:'أخصائي الإسناد'},{label:'الحالة'}],
      rows:[
        ['صك 12009887654','PO-002','تركات','—',pill('يومان',GOLD)],
        ['صك 66778899001','PO-2026-7','تركات','عبدالله الكثيري',pill('٥ أيام',GOLD)],
        ['صك 22334455667','PO-2026-0011','تنفيذ','عمر',pill('متأخر',RED)],
        ['صك 99887766554','PO-004','تنفيذ','أيمن مجرشي',pill('يومان',GOLD)]
      ] },
    'طلبات التقييم': { stats:[[18,'طلبات نشطة',''],[9,'مكتملة',''],[7,'قيد التنفيذ',''],[2,'متعذرة','']],
      cols:[{label:'رقم الطلب',first:true},{label:'العقار'},{label:'المنطقة'},{label:'النوع'},{label:'المقيم المُسند'},{label:'الحالة'},{label:'التاريخ'},{label:'إجراء'}],
      rows:[
        ['VR-441','صك 10203040506','مكة — العزيزية','فيلا','عبدالله الكثيري',pill('قيد التنفيذ',GOLD),'28/06/2026','<button class="btn-ghost" style="padding:5px 12px;font-size:12px">عرض</button>'],
        ['VR-438','صك 88120044991','جدة — الشرفية','عمارة','محمد دياب',pill('مكتمل',GREEN),'27/06/2026','—'],
        ['VR-435','صك 45500213366','الرياض — النسيم','أرض','عبدالله الكثيري',pill('مكتمل',GREEN),'26/06/2026','—'],
        ['VR-432','صك 77341122008','جدة — السلامة','شقة','محمد دياب',pill('قيد التنفيذ',GOLD),'25/06/2026','<button class="btn-ghost" style="padding:5px 12px;font-size:12px">عرض</button>'],
        ['VR-430','صك 33445566778','الطائف — شهار','مجمع','—',pill('متعذر',RED),'24/06/2026','—']
      ] },
    'الأتعاب والصرف': { stats:[[22,'إجمالي المطالبات',''],[6,'رفعت للمشرف',''],[9,'معتمدة للمالية',''],[7,'مصروفة','']],
      cols:[{label:'المعاملة',first:true},{label:'أمر العمل'},{label:'الصافي (ر.س)'},{label:'حالة العمل'},{label:'حالة الدفع'},{label:'إجراء'}],
      rows:[
        ['فيلا — العزيزية','PO-004','٨٬٥٠٠',pill('مكتمل',GREEN),pill('عند المالية',AMBER),'<button class="btn-ghost" style="padding:5px 12px;font-size:12px">صرف</button>'],
        ['عمارة — الشرفية','PO-2026-7','٦٬٢٠٠',pill('مكتمل',GREEN),pill('طلب صرف',NAVY),'<button class="btn-ghost" style="padding:5px 12px;font-size:12px">صرف</button>'],
        ['أرض — النسيم','PO-2026-0005','٣٬٢٠٠',pill('قيد العمل',GOLD),pill('عند المكتب',GRAY),'—'],
        ['مجمع — السلامة','PO-2026-0011','٤٬٠٠٠',pill('مكتمل',GREEN),pill('مصروف',GREEN),'—'],
        ['شقة — الشوقية','PO-002','٢٬٧٥٠',pill('مكتمل',GREEN),pill('معاد للمكتب',RED),'<button class="btn-ghost" style="padding:5px 12px;font-size:12px">إعادة الإرسال</button>']
      ] }
  };

  function goPoList(){
    setHeader('أوامر العمل (PO)', crumb(['لوحة التحكم','دراسة الحالة','أوامر العمل']));
    navActive('أوامر العمل (PO)');
    showView('po');
  }

  // sidebar navigation
  document.querySelectorAll('.nav-item').forEach(function(n){
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
    var s=document.getElementBy