function pdInspectionHtml(p,o,ed){
    var loc=[p.city,p.district].filter(Boolean).join(' — ')||'—';
    var CITY_GEO={'الرياض':[24.7136,46.6753],'جدة':[21.4858,39.1925],'مكة المكرمة':[21.3891,39.8579],'الطائف':[21.2703,40.4158],'الدمام':[26.4207,50.0888]};
    var g=(CITY_GEO[p.city]||[21.4858,39.1925]).slice(); var s=0; String(p.deed||'').split('').forEach(function(c,i){ s+=c.charCodeAt(0)*(i+1); }); g[0]+=((s%37)-18)/1000; g[1]+=((s%53)-26)/1000;
    var head='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:'+(ed?'color-mix(in srgb,var(--gold) 10%,transparent)':'var(--surface-2)')+';border:1px solid var(--border);border-radius:8px;padding:11px 14px;margin-bottom:14px">'+
      '<div style="font-size:12px;color:var(--text-2);line-height:1.6">'+(ed
        ? '<strong style="color:var(--gold-d)">وضع الإدخال</strong> — تُدخل بيانات المعاينة الميدانية وتُرسل بعد اكتمالها.'
        : '<strong>للاطلاع فقط</strong> — ملخص تقرير المعاين. للتعديل اضغط «معاينة العقار» لفتح وضع الإدخال.')+'</div>'+
      (ed? '<div style="display:flex;gap:8px;flex-none"><button data-pd-act="inspect-save" class="primary" style="padding:6px 16px;font-size:11.5px">حفظ وإرسال</button><button data-pd-act="inspect-view" style="padding:6px 14px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">إلغاء</button></div>'
         : '<div style="display:flex;gap:8px;flex-none"><button data-pd-act="inspect-return" style="padding:6px 14px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">إعادة للتصحيح</button></div>')+
      '</div>';
    var c1=insCard('بيانات المعاينة',insBadge('إلزامي','danger'),
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span style="font-size:11px;font-weight:600;color:var(--text-2)">موقع العقار على الخريطة (GPS)</span>'+insBadge('مشترك','purple')+'<span style="font-size:10.5px;color:var(--text-3)">— إثبات النزول الميداني</span></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px">'+insField('خط العرض',g[0].toFixed(5),ed)+insField('خط الطول',g[1].toFixed(5),ed)+'</div>'+
      '<div style="position:relative;height:200px;border-radius:8px;overflow:hidden;border:1px solid var(--border)"><iframe title="خريطة المعاينة" loading="lazy" style="width:100%;height:100%;border:0;display:block" src="https://www.openstreetmap.org/export/embed.html?bbox='+(g[1]-0.006).toFixed(5)+'%2C'+(g[0]-0.004).toFixed(5)+'%2C'+(g[1]+0.006).toFixed(5)+'%2C'+(g[0]+0.004).toFixed(5)+'&amp;layer=mapnik&amp;marker='+g[0]+'%2C'+g[1]+'"></iframe></div>');
    var c2=insCard('نموذج التحقق الميداني — خصائص العقار','',
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'+
      '<thead><tr>'+['#','الحقل','القيمة','صورة'].map(function(h,i){ return '<th style="border:1px solid var(--border);background:var(--surface-2);padding:7px 10px;font-size:11px;font-weight:700;color:var(--text-2);text-align:'+(i===1?'right':'center')+'">'+h+'</th>'; }).join('')+'</tr></thead><tbody>'+
      INS_FEATURES.map(function(f,i){ return '<tr><td style="border:1px solid var(--border);padding:6px 8px;text-align:center;color:var(--text-3)">'+(i+1)+'</td>'+
        '<td style="border:1px solid var(--border);padding:6px 10px">'+f[0]+(f[3]?' '+insBadge('مشترك','purple'):'')+'</td>'+
        '<td style="border:1px solid var(--border);padding:6px 8px">'+(ed?'<select style="width:100%;appearance:none;padding:5px 9px;border:1px solid var(--border-2);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;font-family:inherit">'+f[2].map(function(o){ return '<option'+(o===f[1]?' selected':'')+'>'+o+'</option>'; }).join('')+'</select>':'<span style="font-weight:600;color:var(--heading)">'+f[1]+'</span>')+'</td>'+
        '<td style="border:1px solid var(--border);padding:6px 8px;text-align:center;color:var(--text-3)">'+(['فيلا','شمالية','سكني','جيد','نعم'].indexOf(f[1])>-1?'<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;color:#1f6f6f"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>مرفقة</span>':'—')+'</td></tr>'; }).join('')+
      '</tbody></table>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:12px">'+insField('عمر العقار (سنوات)','6',ed,null,insBadge('مشترك','purple'))+'</div>'+
      '<div style="font-size:10.5px;color:var(--text-3);margin-top:6px">عمر العقار يظهر بعد تحديد «الأصل محل التقييم» ولا ينطبق على الأرض.</div></div>');
    var c3=insCard('الموقع والوصول',insBadge('إدخال ميداني','danger'),
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:12px">'+insField('اسم الشارع','شارع الأمير سلطان',ed)+insField('أقرب شارع رئيسي','طريق المدينة',ed)+insField('عرض الشارع الرئيسي (م)','15',ed)+'</div>'+
      insField('طريقة الوصول للعقار','من طريق المدينة، مخرج الحي الثالث، ثم يمين عند الإشارة.',ed));
    var c4=insCard('مكوّنات العقار',insBadge('إدخال ميداني','danger'),
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px">'+INS_COMPONENTS.filter(function(x){ return x[0]!=='عمر العقار (سنوات)'; }).map(function(x){ return insField(x[0],x[1],ed); }).join('')+insField('هل يوجد ملحق؟','نعم',ed,['نعم','لا'])+insField('ملحق علوي (عدد)','1',ed)+insField('ملحق أرضي (عدد)','0',ed)+'</div>');
    var c5=insCard('مساحات المباني',insBadge('إدخال ميداني','danger'),
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">'+INS_AREAS.map(function(x){ return insField(x[0],x[1],ed); }).join('')+'</div>');
    var c6=insCard('الحدود والأطوال',insBadge('للمطابقة — المصدر: الأخصائي (البورصة)','info'),
      '<div style="font-size:11px;color:var(--text-3);margin-bottom:8px">دور المعاين هنا مطابقة بيانات البورصة واكتشاف الخطأ — يؤكد المطابقة أو يعلّق بعدم المطابقة.</div>'+
      INS_BOUNDS.map(function(b,bi){ return '<div style="display:grid;grid-template-columns:90px 1fr 70px auto;gap:10px;align-items:start;padding:8px 0;border-bottom:1px solid var(--border)">'+
        '<span style="font-size:12px;font-weight:600;color:var(--text-2)">'+b[0]+'</span>'+
        '<span style="font-size:12px;color:var(--text)">'+b[1]+'</span>'+
        '<span style="font-size:12px;font-weight:600">'+b[2]+' م</span>'+
        (ed
          ? '<div data-ins-bound="'+bi+'"><div data-ins-bpills style="display:inline-flex;gap:6px">'+[['match','مطابق','#1f6f6f'],['no','عدم تطابق','#d9694f']].map(function(op){ var on=(op[0]==='match')===!!b[3]; return '<button type="button" data-ins-bopt="'+op[0]+'" style="min-height:34px;padding:6px 12px;border-radius:8px;border:1.5px solid '+(on?op[2]:'var(--border-2)')+';background:'+(on?'color-mix(in srgb,'+op[2]+' 12%,transparent)':'var(--surface)')+';color:'+(on?op[2]:'var(--text-2)')+';font-size:11.5px;font-weight:700;font-family:inherit;cursor:pointer">'+op[1]+'</button>'; }).join('')+'</div>'+
            '<div data-ins-bnote style="display:'+(b[3]?'none':'block')+';margin-top:6px"><input value="'+esc(b[4]||'')+'" placeholder="ملاحظة عدم المطابقة…" style="width:100%;min-width:200px;padding:7px 11px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text);font-size:12px;font-family:inherit" /></div></div>'
          : '<div><span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:'+(b[3]?'#1f6f6f':'#d9694f')+'">'+(b[3]?'مطابق':'عدم تطابق')+'</span>'+(b[4]?'<div style="font-size:10.5px;color:#d9694f;margin-top:3px;max-width:220px;line-height:1.5">'+b[4]+'</div>':'')+'</div>')+
        '</div>'; }).join(''));
    var chip=function(t,on){ return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;padding:5px 11px;border-radius:8px;border:1px solid '+(on?'color-mix(in srgb,#1f6f6f 30%,transparent)':'var(--border)')+';background:'+(on?'color-mix(in srgb,#2a8f8f 12%,transparent)':'var(--surface-2)')+';color:'+(on?'#1f6f6f':'var(--text-3)')+'">'+(on?'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>':'')+t+'</span>'; };
    var c7=insCard('الخدمات والمرافق المحيطة',insBadge('اختيار متعدد','def'),
      '<div style="font-size:11px;font-weight:600;color:var(--text-2);margin-bottom:8px">الخدمات المتوفرة</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px">'+INS_SERVICES.map(function(t){ return chip(t,INS_SERVICES_ON.indexOf(t)>-1); }).join('')+'</div>'+
      '<div style="font-size:11px;font-weight:600;color:var(--text-2);margin-bottom:8px">المرافق المحيطة</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:7px">'+INS_AMENITIES.map(function(t){ return chip(t,INS_AMENITIES_ON.indexOf(t)>-1); }).join('')+'</div>');
    var c8=insCard('الوصف والملاحظات',insBadge('نص حر','def'),
      insField('وصف العقار','فيلا سكنية دورين وملحق، تشطيب حديث، بحالة جيدة.',ed)+
      '<div style="height:12px"></div>'+insField('الإيجابيات والعيوب الظاهرة على الحي','حي هادئ قريب من الخدمات، ازدحام نسبي وقت الذروة.',ed)+
      '<div style="height:12px"></div>'+insField('ملاحظات على الأصل','يلزم صيانة تشقق السور الجنوبي.',ed));
    var c9=insCard('صور العقار الموثّقة',insBadge((function(){ var d=INS_PHOTOS.filter(function(x){return x[1];}).length; return d+'/'+INS_PHOTOS.length+' مكتمل'; })(),'info'),
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">'+INS_PHOTOS.map(function(x){ return '<div style="position:relative;height:100px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);display:grid;place-items:center;overflow:hidden">'+
        (x[1]? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-2 4 4"/></svg>'
             : '<span style="font-size:10.5px;color:#d9694f">بانتظار الرفع</span>')+
        '<span style="position:absolute;bottom:0;inset-inline:0;background:rgba(16,43,78,.72);color:#fff;font-size:9.5px;padding:3px 6px;text-align:center">'+x[0]+'</span></div>'; }).join('')+'</div>');
    var c10=insCard('ملاحظات العقار الموثّقة بالصور',insBadge('شرح + صورة لكل ملاحظة','danger'),
      '<div id="insObsList" style="display:grid;gap:9px">'+INS_OBS.map(function(ob){ return '<div data-ins-obrow style="display:flex;gap:10px;align-items:stretch;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:9px">'+
        '<div style="flex:none;width:74px;border-radius:6px;border:1px solid var(--border);background:var(--surface);display:grid;place-items:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-2 4 4"/></svg></div>'+
        '<div style="min-width:0;flex:1"><span style="font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:99px;background:var(--gold-soft);color:var(--gold-d)">'+ob[0]+'</span>'+
        '<div style="font-size:12px;color:var(--text-2);line-height:1.6;margin-top:6px;text-wrap:pretty">'+ob[1]+'</div></div>'+(ed?'<button type="button" data-ins-obdel style="flex:none;width:30px;align-self:start;height:30px;border-radius:6px;border:1px solid var(--border-2);background:var(--surface);color:#d9694f;cursor:pointer;display:grid;place-items:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>':'')+'</div>'; }).join('')+'</div>'+
      (ed?'<button data-ins-addobs class="primary" style="margin-top:10px;padding:8px 16px;font-size:12px;display:inline-flex;align-items:center;gap:7px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>إضافة ملاحظة موثّقة</button>':''));
    return '<div id="pdInspection">'+head+c1+c2+c3+c4+c5+c6+c7+c8+c9+c10+'</div>';
  }
  function renderInspectChooser(p,o){
    var ex=document.getElementById('miChooser'); if(ex) ex.remove();
    var ov=document.createElement('div'); ov.id='miChooser';
    ov.style.cssText='position:fixed;inset:0;z-index:120;background:rgba(16,43,78,.55);backdrop-filter:blur(3px);display:grid;place-items:center;padding:18px';
    var card=function(act,icon,title,sub){ return '<button type="button" data-mi-choose="'+act+'" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:10px;padding:22px 16px;border:1.5px solid var(--border-2);border-radius:16px;background:var(--surface);cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s" onmouseover="this.style.borderColor=\'var(--ink)\';this.style.background=\'color-mix(in srgb,var(--ink) 5%,transparent)\'" onmouseout="this.style.borderColor=\'var(--border-2)\';this.style.background=\'var(--surface)\'">'+
      '<span style="width:52px;height:52px;border-radius:14px;background:color-mix(in srgb,var(--ink) 10%,transparent);color:var(--ink);display:grid;place-items:center">'+icon+'</span>'+
      '<span style="font-size:14px;font-weight:700;color:var(--heading)">'+title+'</span>'+
      '<span style="font-size:11.5px;color:var(--text-3);text-align:center;line-height:1.5">'+sub+'</span></button>'; };
    ov.innerHTML='<div style="width:100%;max-width:440px;background:var(--bg);border-radius:20px;padding:22px;box-shadow:0 24px 60px -12px rgba(16,43,78,.5)">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px"><div style="font-size:16px;font-weight:800;color:var(--heading)">إدخال بيانات المعاينة</div>'+
        '<button type="button" data-mi-xchoose style="width:34px;height:34px;border-radius:10px;border:1px solid var(--border-2);background:var(--surface);color:var(--text-2);cursor:pointer;display:grid;place-items:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>'+
      '<div style="font-size:12.5px;color:var(--text-3);margin-bottom:18px">اختر طريقة الإدخال المناسبة لك.</div>'+
      '<div style="display:flex;gap:12px">'+
        card('inspect-mobile','<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>','عرض الجوال','مبسّط للمعاين الميداني — أزرار كبيرة والتقاط بالكاميرا')+
        card('inspect-desktop','<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>','سطح المكتب','نموذج كامل بجداول وحقول تفصيلية')+
      '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){
      if(e.target===ov || e.target.closest('[data-mi-xchoose]')){ ov.remove(); return; }
      var ch=e.target.closest('[data-mi-choose]'); if(!ch) return;
      var which=ch.getAttribute('data-mi-choose'); ov.remove();
      if(which==='inspect-mobile'){ renderInspectMobile(p,o); }
      else { var it=Array.prototype.slice.call(document.querySelectorAll('#view-property .tab')).find(function(t){ return t.textContent.trim()==='معاينة العقار'; }); if(it){ document.querySelectorAll('#view-property .tab').forEach(function(x){ x.classList.remove('on'); }); it.classList.add('on'); it.classList.remove('hasnew'); } var pn=document.getElementById('pdPanel'); if(pn) pn.innerHTML = pdInspectionHtml(p,o,true); }
    });
  }
  