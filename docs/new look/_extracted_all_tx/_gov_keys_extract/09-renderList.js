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

  /* ── جميع المعاملات (مطابق لـ AllAssignedTransactionsView) ── */
  var CARET = '<span class="caret"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>';
  var ALL_TX = [
    { deed:'10203040506', po:'PO-004',       type:'تنفيذ',   city:'مكة المكرمة', district:'العزيزية',  phase:'دراسة الحالة',      pc:GOLD  },
    { deed:'88120044991', po:'PO-2026-7',    type:'تركات',   city:'جدة',        district:'الشرفية',   phase:'المراجعة الحكومية', pc:GOLD  },
    { deed:'45500213366', po:'PO-2026-0005', type:'قطاع خاص', city:'الرياض',     district:'النسيم',    phase:'البورصة',          pc:AMBER },
    { deed:'77341122008', po:'PO-2026-0011', type:'تنفيذ',   city:'جدة',        district:'السلامة',   phase:'التوزيع',          pc:GOLD  },
    { deed:'12009887654', po:'PO-001',       type:'تنفيذ',   city:'الطائف',     district:'الحوية',    phase:'البيانات الأولية',  pc:GRAY  },
    { deed:'33445566778', po:'PO-2026-0010', type:'تنفيذ',   city:'الدمام',     district:'الفيصلية',  phase:'مكتمل',            pc:GREEN },
    { deed:'90011223344', po:'PO-004',       type:'تنفيذ',   city:'مكة المكرمة', district:'الشوقية',   phase:'التوزيع',          pc:GOLD  },
    { deed:'55667788990', po:'PO-2026-0011', type:'تنفيذ',   city:'جدة',        district:'النزهة',    phase:'دراسة الحالة',      pc:GOLD  },
    { deed:'21324354657', po:'PO-2026-7',    type:'تركات',   city:'الرياض',     district:'الملز',     phase:'البورصة',          pc:AMBER },
    { deed:'68797061524', po:'PO-0006',      type:'تنفيذ',   city:'مكة المكرمة', district:'العوالي',   phase:'البيانات الأولية',  pc:GRAY  },
    { deed:'44556677889', po:'PO-2026-0010', type:'تنفيذ',   city:'الطائف',     district:'الوسام',    phase:'مكتمل',            pc:GREEN },
    { deed:'11223344556', po:'PO-2026-0011', type:'تنفيذ',   city:'الدمام',     district:'الشاطئ',    phase:'المراجعة الحكومية', pc:GOLD  }
  ];
  var TX_STATE = { search:'', status:'', t