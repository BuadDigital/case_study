function openKeyResult(envId,i){
    var env=KEY_ENV.find(function(x){return x.id===envId;}); if(!env||!env.assignments[i]) return;
    var a=env.assignments[i];
    keyCloseModal();
    var body=
      '<div class="tf-note" style="margin-bottom:14px">نتيجة المطابقة الميدانية للصك <b>'+esc(a.deed)+'</b>.</div>'+
      '<div class="form-grid">'+
        '<div class="fld full"><label>نتيجة تجربة المفاتيح ميدانياً *</label><div id="kr_tiles" style="display:grid;gap:8px">'+
          [['matched','مطابق','فُتح العقار بالمفاتيح','#2f7a4d'],['partial','مطابقة جزئية','بعض الوحدات فقط','#b58a3c'],['unmatched','غير مطابق','لا مفتاح مناسب','#d9694f'],['unmatched_inspected','غير مطابق — تمت المعاينة','عوين العقار بالكامل رغم عدم المطابقة','#8a5e14'],['missing','مفقود','لم يُعثر على المفتاح','#c0553d']].map(function(o){
            return '<button type="button" data-krt="'+o[0]+'" style="display:flex;align-items:center;gap:12px;min-height:52px;padding:10px 14px;border-radius:12px;border:1.5px solid var(--border-2);background:var(--surface-2);cursor:pointer;text-align:start;font-family:inherit;transition:all .12s"><span data-dot style="flex-shrink:0;width:14px;height:14px;border-radius:99px;border:2px solid '+o[3]+';background:transparent"></span><span><span style="display:block;font-size:13.5px;font-weight:800;color:'+o[3]+'">'+o[1]+'</span><span style="display:block;font-size:11.5px;color:var(--text-3);margin-top:1px">'+o[2]+'</span></span></button>'; }).join('')+
        '</div><span class="msg"></span></div>'+
        '<div class="fld full" id="kr_noteFld" style="display:none"><label>ملاحظة *</label><input id="kr_note" placeholder="مثال: عمارة 6 شقق — 5 مفاتيح مطابقة، شقة رقم 3 بدون مفتاح" /><span class="msg"></span></div>'+
      '</div>';
    keyModalShell('تسجيل نتيجة المطابقة', body, 'حفظ النتيجة');
    var krSel='';
    document.querySelectorAll('[data-krt]').forEach(function(b){ b.addEventListener('click',function(){
      krSel=b.getAttribute('data-krt');
      document.querySelectorAll('[data-krt]').forEach(function(x){ var on=x===b;
        x.style.borderColor=on?'var(--gold)':'var(--border-2)'; x.style.background=on?'var(--gold-soft)':'var(--surface-2)';
        var d=x.querySelector('[data-dot]'); d.style.background=on?d.style.borderColor:'transparent'; });
      document.getElementById('kr_noteFld').style.display=krSel==='matched'?'none':'';
    }); });
    document.getElementById('keySaveBtn').addEventListener('click',function(){
      var st=krSel;
      if(!st){ keyErr('اختر نتيجة المطابقة أولاً.'); return; }
      var note=(document.getElementById('kr_note').value||'').trim();
      if(st!=='matched'&&!note){ keyErr('الملاحظة إلزامية لغير المطابق الكامل — سجّل تفاصيل الوحدات والمفاتيح.'); return; }
      a.status=st; a.confirmedBy='المعاين'; a.note=note||'فُتح العقار بالمفاتيح (تأكيد ميداني)';
      var lbl=keyAssign(st)[0];
      env.timeline.push({ev:'confirm',date:keyToday().dt,detail:'تأكيد ميداني للصك '+a.deed+': '+lbl+(note?' — '+note:'')});
      keyPersist(); keyCloseModal(); renderKeyDetail(env.id); showToast('سُجّلت نتيجة الصك '+a.deed+' — '+lbl+'.');
    });
  }