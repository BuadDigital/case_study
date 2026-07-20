nav-item').forEach(function(n){
      var s = n.querySelector('span'); n.classList.toggle('active', !!s && s.textContent.trim() === label);
    });
  }

  var OWNERS = ['محمد الغامدي','سارة القرشي','عبدالعزيز الشهري','نورة العتيبي','خالد باوزير','هند الزهراني','فيصل الحارثي'];
  var CITIES = [['مكة المكرمة','العزيزية'],['جدة','الشرفية'],['الرياض','النسيم'],['الطائف','شهار'],['جدة','السلامة'],['مكة المكرمة','الشوقية']];
  var CLASSES = [['أرض','سكنية'],['مبنى مفرد','فيلا'],['مجمع','تجاري'],['وحدة داخل مبنى','شقة سكنية'],['مبنى مفرد','عمارة'],['أرض','تجارية']];
  var DEEDST = ['فعال','موقوف','قيد التحقق'];
  var PSTATUS = { 'new':{t:'جديد',c:'#8a8d96'}, 'progress':{t:'قيد العمل',c:'var(--gold)'}, 'done':{t:'مكتمل',c:'#3f8f5f'}, 'fail':{t:'متعذر',c:'#d9694f'}, 'incomplete':{t:'ناقص',c:'#d9a441'} };
  var PACTION = { 'new':'بدء الدراسة', 'progress':'متابعة الإجراء الحالي', 'incomplete':'استكمال النواقص', 'fail':'معالجة التعذّر' };

  function genProps(o){
    if (o._props) return o._props;
    var arr = [];
    for (var i = 0; i < o.count; i++){
      var reg = i < o.registered, done = i < o.done;
      var st = done ? 'done' : (reg ? (o.status === 'متوقف' ? 'incomplete' : 'progress') : 'new');
      if (o.status === 'ملغي') st = 'fail';
      var cc = CLASSES[i % CLASSES.length], loc = CITIES[i % CITIES.length];
      var deedNo = String(10203040506 + i * 79190737 + (o.recTs % 100000)).slice(0, 12);
      arr.push({
        id: o.po + '-P' + (i + 1), idx: i + 1,
        deed: reg ? deedNo : 'قيد الدراسة', registered: reg,
        city: loc[0], district: loc[1], cls: cc[0], ptype: cc[1],
        deedStatus: reg ? DEEDST[i % DEEDST.length] : '—',
        area: 300 + (i * 137) % 2400, owner: OWNERS[i % OWNERS.length],
        request: String(100200 + i * 3), court: 'محكمة التنفيذ ب' + loc[0].split(' ')[0],
        circuit: 'الدائرة ' + ['الأولى','الثانية','الثالثة'][i % 3], status: st
      });
    }
    o._props = arr; return arr;
  }

  var typeTone = { 'تنفيذ':'#378add', 'تركات':'#ef9f27', 'قطاع خاص':'var(--gold)' };

  function remainLabel(o){
    if (TERMINAL[o.status]) return '—';
    var diff = o.dueTs - NOW;
    if (diff < 0) return 'متأخر';
    var d = Math.ceil(diff / DAY);
    return d <= 0 ? 'اليوم' : (d + (d === 1 ? ' يوم' : (d === 2 ? ' يومان' : ' أيام')));
  }

  function renderProperties(poId){
    var o = ORDERS.find(function(x){ return x.po === poId; }); if (!o) return;
    var props = genProps(o);
    var tone = typeTone[o.type] || '#8a8d96';
    var sc = STATUS[o.status] || STATUS['قيد الدراسة'];
    var PPCOLS = 'minmax(120px,1.3fr) minmax(90px,1fr) minmax(110px,1.1fr) minmax(84px,.8fr) minmax(92px,.9fr) 44px';
    var rows = props.map(function(p){
      var ps = PSTATUS[p.status];
      return '<div class="row" data-prop="' + esc(p.id) + '" data-po="' + esc(poId) + '" style="cursor:pointer;grid-template-columns:' + PPCOLS + '">' +
        '<div class="td"><span style="display:inline-flex;align-items:center;gap:8px"><span class="ppt-num">' + p.idx + '</span><span class="ppt-deed">' + esc(p.deed) + '</span></span></div>' +
        '<div class="td muted">' + esc(p.city + ' · ' + p.district) + '</div>' +
        '<div class="td">' + esc(p.cls + ' · ' + p.ptype) + '</div>' +
        '<div class="td muted">' + esc(p.deedStatus) + '</div>' +
        '<div class="td"><span class="status" style="background:color-mix(in srgb,' + ps.c + ' 15%,transparent);color:' + ps.c + '"><span class="sd" style="background:' + ps.c + '"></span>' + ps.t + '</span></div>' +
        '<div class="td"><div class="actions"><button class="kebab" aria-label="إجراءات العقار"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button><div class="act-pop">' +
          (p.status !== 'done' ? '<div class="act-row" data-prop="' + esc(p.id) + '" data-po="' + esc(poId) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v18l7-5 7 5V3z" opacity="0"/><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg><span>' + esc(PACTION[p.status] || 'متابعة الإجراء') + '</span></div>' +
            '<div class="act-sep"></div>' : '') +
          '<div class="act-row" data-prop="' + esc(p.id) + '" data-po="' + esc(poId) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span>تفاصيل العقار</span></div>' +
          '<div class="act-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span>تعديل العقار</span></div>' +
          (p.status === 'done' ? '<div class="act-sep"></div>' +
            '<div class="act-row" data-reopen="' + esc(p.id) + '" data-po="' + esc(poId) + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg><span>فتح المعاملة</span><span style="margin-inline-start:auto;background:color-mix(in srgb,#d9694f 15%,transparent);color:#c0553d;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px">صلاحية عالية</span></div>' : '') +
          '<div class="act-sep"></div>' +
          '<div class="act-row danger"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg><span>رفع تعذّر</span></div>' +
        '</div></div></div>' +
    