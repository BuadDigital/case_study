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