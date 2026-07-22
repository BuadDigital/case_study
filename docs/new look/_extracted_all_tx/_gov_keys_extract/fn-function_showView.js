function showView(name){
    VIEWS.forEach(function(v){ var el = document.getElementById('view-' + v); if (el) el.hidden = (v !== name); });
    document.querySelector('.content').scrollTop = 0;
  }
  function navActive(label){
    document.querySelectorAll('.nav-item').forEach(function(n){
      var s = n.querySelector('span'); n.classList.toggle('active', !!s && s.textContent.trim() === label);
    });
  }

  var OWNERS = ['محمد الغامدي','سارة القرشي','عبدالعزيز الشهري','نورة العتيبي','خالد باوزير','هند الزهراني','فيصل الحارثي'];
  var CITIES = [['مكة المكرمة','العزيزية'],['جدة','الشرفية'],['الرياض','النسيم'],['الطائف','شهار'],['جدة','السلامة'],['مكة المكرمة','الشوقية']];
  var CLASSES = [['أرض','سكنية'],['مبنى مفرد','فيلا'],['مجمع','تجاري'],['وحدة داخل مبنى','شقة سكنية'],['مبنى مفرد','عمارة'],['أرض','تجارية']];
  var DEEDST = ['فعال','غير فعال'];
  var PSTATUS = { 'new':{t:'جديد',c:'#8a8d96'}, 'progress':{t:'قيد العمل',c:'var(--gold)'}, 'done':{t:'مكتمل',c:'#3f8f5f'}, 'fail':{t:'متعذر',c:'#d9694f'}, 'incomplete':{t:'ناقص',c:'#d9a441'} };
  var PACTION = { 'new':'بدء الدراسة', 'progress':'متابعة الإجراء الحالي', 'incomplete':'استكمال النواقص', 'fail':'معالجة التعذّر' };

  function genProps(o){
    if (o._props) return o._props;
    var arr = [];
    var reqNo = String(100200 + (o.recTs % 997) * 7);
    for (var i = 0; i < o.count; i++){
      var reg = i < o.registered, done = i < o.done;
      var st = done ? 'done' : (reg ? (o.status === 'متوقف' ? 'incomplete' : 'progress') : 'new');
      if (o.status === 'ملغي') st = 'fail';
      var cc = CLASSES[i % CLASSES.length], loc = CITIES[i % CITIES.length];
      var deedNo = String(10203040506 + i * 79190737 + (Math.floor(o.recTs / 86400000) % 97) * 1300921).slice(0, 12);
      arr.push({
        id: o.po + '-P' + (i + 1), idx: i + 1,
        deed: reg ? deedNo : 'لم يسجل بعد', registered: reg, awaiting: !reg,
        city: reg ? loc[0] : '', district: reg ? loc[1] : '', cls: reg ? cc[0] : '', ptype: reg ? cc[1] : '',
        deedStatus: reg ? DEEDST[i % DEEDST.length] : '',
        area: reg ? (300 + (i * 137) % 2400) : '', owner: reg ? OWNERS[i % OWNERS.length] : '',
        request: reg ? reqNo : '', court: reg ? ('محكمة التنفيذ ب' + loc[0].split(' ')[0]) : '',
        circuit: reg ? ('الدائرة ' + ['الأولى','الثانية','الثالثة'][i % 3]) : '', status: st
      });
    }
    o._props = arr; return arr;
  }

  var typeTone = { 'تنفيذ':'#378add', 'تركات':'#ef9f27', 'قطاع خاص':'var(--gold)' };

  function re