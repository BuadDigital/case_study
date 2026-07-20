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
  var TX_STATE = { search:'', status:'', type:'', group:false, collapsed:{} };
  function txMoreMenu(){
    return '<div class="actions"><button class="kebab" aria-label="خيارات المعاملة"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></button>' +
      '<div class="act-pop">' +
        '<div class="act-row"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span>فتح المعاملة</span></div>' +
        '<div class="act-row"><svg width="16" height="16" viewBox="0 0 24 24" fi