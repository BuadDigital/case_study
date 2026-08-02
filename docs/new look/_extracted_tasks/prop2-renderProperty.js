function renderProperty(poId, propId){
    var o = ORDERS.find(function(x){ return x.po === poId; }); if (!o) return;
    var props = genProps(o), p = props.find(function(x){ return x.id === propId; }); if (!p) return;
    var locTxt = p.awaiting ? 'بانتظار البورصة' : (p.city + ' · ' + p.district);
    var courtTxt = p.awaiting ? '—' : (p.court + ' / ' + p.circuit);
    var areaTxt = p.awaiting ? '—' : (p.area + ' م²');
    var ps = PSTATUS[p.status];
    var stripCell=function(k,v,ltr){ return '<div style="min-width:0;padding:4px 0;padding-inline-start:18px;padding-inline-end:22px;border-inline-start:1px solid var(--border)"><div style="font-size:11px;color:var(--text-3);margin-bottom:2px">'+k+'</div><div style="font-size:13px;font-weight:600;color:var(--text)'+(ltr?';direction:ltr;text-align:end':'')+'">'+v+'</div></div>'; };
    var fieldBox=function(k,v,ltr){ return '<div style="background:color-mix(in srgb,var(--gold-soft) 45%,transparent);border-radius:4px;padding:10px 14px"><div style="font-size:10.5px;color:var(--text-3);margin-bottom:3px">'+k+'</div><div style="font-size:12.5px;font-weight:600;color:var(--text)'+(ltr?';direction:ltr;text-align:end':'')+'">'+(v||'—')+'</div></div>'; };
    var sec=function(t){ return '<div style="font-size:13px;font-weight:700;color:var(--heading);margin:18px 0 10px;text-align:start">'+t+'</div>'; };
    var linkBox=function(k,txt){ return '<div style="background:color-mix(in srgb,var(--gold-soft) 45%,transparent);border-radius:4px;padding:10px 14px;grid-column:span 2"><div style="font-size:10.5px;color:var(--text-3);margin-bottom:3px">'+k+'</div><a href="#" onclick="return false" style="font-size:12.5px;font-weight:600;color:var(--gold-d);text-decoration:underline;text-underline-offset:3px">'+txt+'</a></div>'; };
    var CITY_GEO={'الرياض':[24.7136,46.6753],'جدة':[21.4858,39.1925],'مكة المكرمة':[21.3891,39.8579],'الطائف':[21.2703,40.4158],'الدمام':[26.4207,50.0888]};
    var GEO=(CITY_GEO[p.city]||[21.4858,39.1925]).slice();
    (function(){ var s=0; String(p.deed||'').split('').forEach(function(c,i){ s+=c.charCodeAt(0)*(i+1); }); GEO[0]+=((s%37)-18)/1000; GEO[1]+=((s%53)-26)/1000; })();
    if(p._geo){ GEO[0]=p._geo[0]; GEO[1]=p._geo[1]; }
    var dms=function(dec,pos,neg){ var a=Math.abs(dec),d=Math.floor(a),m=Math.floor((a-d)*60),s=((a-d)*60-m)*60; return d+'°'+m+'\''+s.toFixed(1)+'"'+(dec>=0?pos:neg); };
    var geoDMS=dms(GEO[0],'N','S')+' '+dms(GEO[1],'E','W');
    var geoDEC=GEO[0].toFixed(6)+', '+GEO[1].toFixed(6);
    var basics =
      '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,3fr);gap:12px;margin-bottom:4px">'+
        '<div style="min-width:0;display:flex;flex-direction:column"><div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;min-width:0"><div style="font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">صورة العقار الرئيسية</div><span style="flex:none;font-size:10px;font-weight:600;color:var(--gold-d)">من المعاين</span></div><image-slot id="pd-photo-'+p.deed+'" shape="rounded" radius="4" style="width:100%;height:200px" placeholder="الصورة الرئيسية المحددة من شاشة المعاين"></image-slot><div style="flex:1;margin-top:8px;background:color-mix(in srgb,var(--gold-soft) 45%,transparent);border-radius:4px;padding:8px 12px"><div style="font-size:10.5px;color:var(--text-3);margin-bottom:3px">وصف العقار</div><div style="font-size:12px;font-weight:600;color:var(--text);line-height:1.7;text-wrap:pretty">'+(p.awaiting?'—':esc(p.ptype+' '+p.cls+'، مساحة '+areaTxt+'، بحي '+(p.district||'—')+'. يُحدَّث الوصف التفصيلي من تقرير المعاين.'))+'</div></div></div>'+
        '<div style="min-width:0;display:flex;flex-direction:column"><div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;min-width:0"><div style="font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">موقع العقار المعتمد</div><a href="https://www.google.com/maps/search/?api=1&query='+GEO[0]+','+GEO[1]+'" target="_blank" rel="noopener" style="flex:none;font-size:11px;font-weight:600;color:var(--gold-d);text-decoration:none;white-space:nowrap">خرائط جوجل ↗</a></div>'+
          '<div style="position:relative;min-width:0;height:200px;border-radius:4px;overflow:hidden;border:1px solid var(--border)">'+
            '<iframe data-pd-map title="خريطة موقع العقار" loading="lazy" style="width:100%;height:100%;border:0;display:block" src="https://www.openstreetmap.org/export/embed.html?bbox='+(GEO[1]-0.006).toFixed(5)+'%2C'+(GEO[0]-0.004).toFixed(5)+'%2C'+(GEO[1]+0.006).toFixed(5)+'%2C'+(GEO[0]+0.004).toFixed(5)+'&amp;layer=mapnik&amp;marker='+GEO[0]+'%2C'+GEO[1]+'"></iframe>'+
          '</div>'+
          '<div data-coord-blk style="flex:1;margin-top:8px;background:color-mix(in srgb,var(--gold-soft) 45%,transparent);border-radius:4px;padding:8px 12px;display:flex;flex-direction:column;justify-content:center">'+
            '<div data-coord-view style="display:flex;align-items:center;justify-content:space-between;gap:10px"><div style="min-width:0"><div style="font-size:10.5px;color:var(--text-3);margin-bottom:3px">إحداثيات الموقع</div><div data-coord-dms style="font-size:12.5px;font-weight:600;color:var(--text);direction:ltr;text-align:start">'+geoDMS+'</div><div data-coord-dec style="font-size:11px;color:var(--text-3);direction:ltr;text-align:start;margin-top:1px">'+geoDEC+'</div></div><div style="flex:none;display:flex;gap:6px"><button type="button" data-pd-act="coord-copy" title="نسخ الإحداثيات" style="display:inline-flex;align-items:center;gap:5px;background:var(--surface);border:1px solid var(--border-2);border-radius:6px;padding:6px 10px;font-size:11px;font-weight:600;color:var(--gold-d);cursor:pointer"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>نسخ</button></div></div>'+
            '<div data-coord-form style="display:none"></div>'+
          '</div></div>'+
      '</div>'+
      sec('بيانات الصك')+
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">'+
        fieldBox('رقم أمر العمل',esc(o.po),1)+fieldBox('رقم الصك',esc(p.deed),1)+fieldBox('رقم التكليف',esc(p.deed),1)+fieldBox('تاريخ التكليف',esc(o.due),1)+
        fieldBox('رقم الطلب',esc(p.request),1)+fieldBox('تاريخ الصك','2024-11-04',1)+fieldBox('حالة الصك',esc(p.deedStatus))+
        fieldBox('اسم المالك',esc(p.owner))+fieldBox('حالة الملك','فعال')+fieldBox('القيود على العقار','لا توجد قيود')+
      '</div>'+
      sec('بيانات الموقع')+
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">'+
        fieldBox('المدينة',esc(p.city||'—'))+fieldBox('الحي',esc(p.district||'—'))+fieldBox('المحكمة / الدائرة',esc(courtTxt))+
        fieldBox('رقم المخطط','غير محدد')+fieldBox('رقم القطعة','غير محدد')+
      '</div>'+
      sec('البيانات المساحية')+
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">'+
        fieldBox('التصنيف',esc(p.cls))+fieldBox('النوع / الاستخدام',esc(p.ptype))+fieldBox('المساحة الإجمالية',esc(areaTxt))+
      '</div>'+
      '<div style="font-size:11.5px;font-weight:700;color:var(--heading);margin:14px 0 8px;text-align:start">حدود العقار وأطواله</div>'+
      (p.awaiting
        ? '<div style="background:#fef3d7;border:1px solid #fad7a0;color:#7a5b12;border-radius:4px;padding:9px 12px;font-size:11.5px;line-height:1.7">بانتظار بيانات البورصة — تُعرض حدود العقار وأطوال أضلاعه بعد اكتمال الاستعلام.</div>'
        : '<div style="border:1px solid var(--border);border-radius:4px;overflow:hidden"><table style="width:100%;border-collapse:collapse;font-size:12px">'+
            '<thead><tr>'+[['الحد','start'],['وصف الحد','center'],['طول الضلع','center']].map(function(h){ return '<th style="background:var(--surface-2);border-bottom:1px solid var(--border);padding:8px 12px;text-align:'+h[1]+';font-size:11px;font-weight:700;color:var(--text-2)">'+h[0]+'</th>'; }).join('')+'</tr></thead><tbody>'+
            [['الحد الشمالي','شارع عرض 14 م','20.00 م'],['الحد الجنوبي','جار — قطعة رقم 45','20.00 م'],['الحد الشرقي','شارع عرض 10 م','25.00 م'],['الحد الغربي','جار — قطعة رقم 47','25.00 م']].map(function(r,i){ return '<tr>'+
              '<td style="border-bottom:'+(i<3?'1px solid var(--border)':'0')+';padding:8px 12px;font-weight:600;color:var(--heading)">'+r[0]+'</td>'+
              '<td style="border-bottom:'+(i<3?'1px solid var(--border)':'0')+';padding:8px 12px;color:var(--text);text-align:center">'+r[1]+'</td>'+
              '<td style="border-bottom:'+(i<3?'1px solid var(--border)':'0')+';padding:8px 12px;color:var(--text);direction:ltr;text-align:center">'+r[2]+'</td>'+
            '</tr>'; }).join('')+'</tbody></table></div>'+
            '<div style="font-size:10.5px;color:var(--text-3);margin-top:6px;text-align:start">«بطول» = طول ضلع العقار على ذلك الحد. المصدر: البورصة العقارية / الصك.</div>')+
      sec('بيانات الاتصال')+
      '<div style="font-size:10.5px;color:var(--text-3);margin:-4px 0 8px;text-align:start">المصدر: البيانات الأولية للمعاملة</div>'+
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+
        fieldBox('الاسم',esc(p.owner))+fieldBox('رقم الجوال','0551234567',1)+fieldBox('الصلة','المالك')+
      '</div>';
    var docRow=function(dc){ var pend=(dc[2]==='—'); var ext=String(dc[2]).split(' ')[0]; if(pend) ext='—';
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:4px;padding:9px 12px'+(pend?';opacity:.72':'')+'">'+
        '<div style="display:flex;align-items:center;gap:9px;min-width:0"><span style="flex:none;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:6px;background:'+(pend?'var(--surface)':'color-mix(in srgb,var(--gold) 14%,transparent)')+';border:1px solid var(--border);color:'+(pend?'var(--text-3)':'var(--gold-d)')+';font-size:9px;font-weight:800">'+ext+'</span>'+
        '<span style="display:inline-flex;flex-direction:column;gap:1px;min-width:0"><span style="font-size:12.5px;font-weight:600;color:var(--text)">'+dc[0]+'</span><span style="font-size:10.5px;color:var(--text-3)">'+dc[1]+(pend?'':' · <span dir="ltr">'+dc[2]+'</span>')+'</span></span></div>'+
        (pend? '<span style="flex:none;font-size:11px;font-weight:700;color:var(--text-3)">لم يُرفع بعد</span>'
             : '<button style="flex:none;padding:5px 12px;border:1px solid var(--border-2);border-radius:6px;background:var(--surface);color:var(--text-2);font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">تنزيل</button>')+'</div>'; };
    var DOC_SRC=[
      ['مركز الإسناد والتصفية',[['صورة الصك','رفع 2026/07/12','PDF · 1.2 MB'],['خطاب المحكمة','رفع 2026/07/12','PDF · 0.4 MB']]],
      ['أخصائي دراسة الحالة',[['بيانات البورصة للعقار','رفع 2026/07/15','PDF · 0.6 MB']]],
      ['المعاين',[['تقرير المعاينة الميدانية','رفع 2026/07/19','PDF · 2.1 MB'],['صور العقار (12 صورة)','رفع 2026/07/19','ZIP · 8.4 MB']]],
      ['المكتب الهندسي',[['التقرير المساحي','بانتظار الرفع','—']]],
      ['المقيّم',[['تقرير التقييم المعتمد','بانتظار الرفع','—']]]
    ];
    var docs = DOC_SRC.map(function(g){
      return '<div style="margin-bottom:14px">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px"><span style="font-size:12px;font-weight:700;color:var(--heading)">'+g[0]+'</span><span style="font-size:10.5px;color:var(--text-3)">'+g[1].length+' مستند</span><span style="flex:1;height:1px;background:var(--border)"></span></div>'+
        '<div style="display:grid;gap:8px">'+g[1].map(docRow).join('')+'</div></div>';
    }).join('')+
      '<div style="font-size:11.5px;color:var(--text-3)">تُرفع المستندات من كل طرف تحت قسمه — التقرير المساحي من المكتب الهندسي عند إصداره، وتقرير المعاينة عند اكتمالها.</div>';
    var PARTIES=[['المعاين','قيد التنفيذ',GOLD],['المكتب الهندسي','قيد التنفيذ',GOLD],['المقيّم','قيد التنفيذ',GOLD],['المراجع الحكومي','غير معيّن',GRAY],['المنسق','قيد التنفيذ',GOLD]];
    var partyPanel=function(x){ return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;min-width:0;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:12px"><span style="font-size:13px;font-weight:700;color:var(--heading)">'+x[0]+'</span>'+pill(x[1],x[2])+'</div>'+'<div class="panel-note">مساهمات '+x[0]+' في المعاملة — البيانات والمستندات والمواعيد الخاصة بهذا الطرف تظهر هنا.</div>'; };
    var valuation='<div class="panel-note">بيانات التقييم تُدخل من نافذة المقيم — مصدر السعر المقيم وحده، ويُعرض للأخصائي للاسترشاد.</div>'+
      '<button class="primary" data-pd-act="appraise" style="margin-top:12px;padding:8px 18px;font-size:12.5px">رفع تقييم — فتح نافذة المقيم</button>';
    var survey='<div class="panel-note">الرفع المساحي ينفذه المكتب الهندسي — تأكيد حدود العقار وقد يتبعه تعديل التقييم.</div>'+
      '<button class="primary" data-pd-act="survey" style="margin-top:12px;padding:8px 18px;font-size:12.5px">رفع التقرير المساحي — مساحة عمل المكتب</button>';
    var inspection='<div class="panel-note">المعاينة الميدانية شرط بدء التقييم — صور مختومة وتقرير ميداني.</div>'+
      '<button class="primary" data-pd-act="inspect" style="margin-top:12px;padding:8px 18px;font-size:12.5px">معاينة العقار — مساحة عمل المعاين</button>';
    var logPanel='<div style="display:flex;flex-direction:column">'+[['أُنشئت المعاملة وتوزيعها','23/07/2026 · 13:45'],['اكتمل استعلام البورصة','23/07/2026 · 13:45'],['عُيّن المعاين الميداني','23/07/2026 · 13:45'],['عُيّن المكتب الهندسي والمقيّم','23/07/2026 · 13:45']].map(function(ev,i){ return '<div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)"><span style="flex:none;width:30px;height:30px;border-radius:99px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,#3f8f5f 10%,transparent);color:#2f7a4d;font-size:13px">✓</span><span style="display:inline-flex;flex-direction:column;gap:2px"><span style="font-size:13px;color:var(--text)">'+ev[0]+'</span><span style="font-size:11px;color:var(--text-2)" dir="ltr">'+ev[1]+'</span></span></div>'; }).join('')+'</div>';
    var emptyPanel=function(t2,s2){ return '<div style="padding:36px 16px;text-align:center;color:var(--text-3)"><div style="font-size:13.5px;font-weight:700;color:var(--text-2);margin-bottom:4px">'+t2+'</div><div style="font-size:12px">'+s2+'</div></div>'; };
    var pdNew=(window.PDNEW=window.PDNEW||['docs','p-valuer','log']);    var tabs=[
      ['basics','البيانات الأساسية',basics],
      ['docs','مستندات العقار',docs],
      ['linked','العقارات المرتبطة',(o.count>1?'<div class="panel-note">عقارات أخرى ضمن '+esc(o.po)+' — '+(o.count-1)+' عقار مرتبط.</div>':emptyPanel('لا توجد عقارات مرتبطة','هذا العقار الوحيد في أمر العمل.'))],
      ['p-eng','التقرير المساحي',partyPanel(PARTIES[1])],
      ['p-inspector','معاينة العقار',pdInspectionHtml(p,o,false)],
      ['photos','صور العقار',(function(){
        var G=[['صورة العقار الرئيسية',1,'المعاين','2026/07/19'],['صور العقار الخارجية',4,'المعاين','2026/07/19'],['صور العقار من الداخل',6,'المعاين','2026/07/19'],['صور عدادات الكهرباء',2,'المعاين','2026/07/19'],['صور الآبار',2,'المكتب الهندسي','2026/07/21'],['صور المشتملات',3,'المعاين','2026/07/19']];
        var tile=function(h){ return '<div style="position:relative;height:'+h+'px;border-radius:4px;border:1px solid var(--border);background:var(--surface-2);display:grid;place-items:center;overflow:hidden">'+
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-2 4 4"/></svg></div>'; };
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px"><div style="font-size:11.5px;color:var(--text-3)">إجمالي '+G.reduce(function(a,b){return a+b[1];},0)+' صورة</div>'+
          '<button data-pd-act="photospdf" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>تنزيل الصور PDF</button></div>'+
          G.map(function(g){
          return '<div style="margin-bottom:16px">'+
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:12px;font-weight:700;color:var(--heading)">'+g[0]+'</span><span style="font-size:10.5px;color:var(--text-3)">'+g[1]+' صورة · '+g[2]+' · <span dir="ltr">'+g[3]+'</span></span><span style="flex:1;height:1px;background:var(--border)"></span></div>'+
            '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">'+
              Array.apply(null,Array(g[1])).map(function(){ return tile(110); }).join('')+
            '</div></div>'; }).join('')+
          '<div style="font-size:11.5px;color:var(--text-3)">الصور مرفوعة من النظام بواسطة المعاين أو الطرف المختص — هذا التبويب للاستعراض فقط.</div>'; })()],
      ['p-gov','المراجعات الحكومية',partyPanel(PARTIES[3])],
      ['keys','مفاتيح العقار',emptyPanel('لا توجد مفاتيح','لم تُسجَّل مفاتيح لهذا العقار بعد.')],
      ['val','تقييم العقار',valuation],
      ['failures','التعذرات',emptyPanel('لا توجد تعذرات','لم يُسجَّل أي تعذر لهذا العقار.')+'<div style="text-align:center;margin-top:8px"><button class="primary" style="padding:6px 16px;font-size:11.5px">تسجيل تعذّر جديد</button></div>'],
      ['report','دراسة العقار','<div class="panel-note">نموذج دراسة الحالة — تُجمَّع بيانات الأطراف ويعتمدها أخصائي دراسة الحالة.</div>'],
      ['enfath','الرفع على انفاذ','<div class="panel-note">تجميع حقول الرفع على إنفاذ من مساهمات الأطراف (المقيّم، المكتب الهندسي، المعاين) قبل الرفع.</div>'+survey],
      ['fin','المالية','<div class="panel-note">الأتعاب والمصروفات المرتبطة بالعقار — أتعاب المعاينة والرفع المساحي تُتابع من شاشة فوترة الأتعاب.</div>'],
      ['log','السجل والتدقيق',logPanel],
      ['notes','ملاحظات','<div id="pdNotes" data-deed="'+esc(p.deed)+'">'+pdNotesHtml(p.deed)+'</div>']
    ];
    var TL=[['توزيع المعاملة','23/07/2026 · 13:45',1],['دراسة حالة العقار','23/07/2026 · 13:45',1],['تعيين المكتب الهندسي','23/07/2026 · 13:45',1],['تعيين المقيّم العقاري','23/07/2026 · 13:45',1],['تعيين المعاين الميداني','23/07/2026 · 13:45',1],['اكتمال استعلام البورصة','23/07/2026 · 13:45',0],['بيانات البورصة للعقار','23/07/2026 · 13:45',0]];
    var rail=
      '<div class="card" style="padding:14px 16px"><div style="font-size:12.5px;font-weight:700;color:var(--heading);margin-bottom:12px;display:flex;align-items:center;gap:7px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>الجدول الزمني</div>'+
        '<div style="display:flex;flex-direction:column">'+TL.map(function(ev,i){ return '<div style="display:flex;gap:10px;position:relative;padding-bottom:'+(i<TL.length-1?'14px':'0')+'">'+
          '<div style="display:flex;flex-direction:column;align-items:center;flex:none"><span style="width:9px;height:9px;border-radius:99px;background:'+(ev[2]?'var(--gold-d)':'var(--ink)')+';margin-top:3px"></span>'+(i<TL.length-1?'<span style="flex:1;width:1px;background:var(--border);margin-top:3px"></span>':'')+'</div>'+
          '<div style="min-width:0"><div style="font-size:11.5px;font-weight:600;color:var(--text)">'+ev[0]+'</div><div style="font-size:10px;color:var(--text-3)" dir="ltr">'+ev[1]+'</div></div></div>'; }).join('')+'</div></div>'+
      '<div class="card" style="padding:14px 16px;margin-top:12px">'+
        '<div style="font-size:12.5px;font-weight:700;color:var(--heading);margin-bottom:12px">حالة الأطراف</div>'+
        '<div style="display:grid;gap:9px">'+PARTIES.map(function(x){ var v=(x[2]===GREEN?1:(x[2]===GRAY?0:.5)); var c=2*Math.PI*9;
          return '<div style="display:flex;align-items:center;gap:9px"><span style="position:relative;width:24px;height:24px;flex:none"><svg width="24" height="24" viewBox="0 0 24 24" style="transform:rotate(-90deg)"><circle cx="12" cy="12" r="9" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="12" cy="12" r="9" fill="none" stroke="'+x[2]+'" stroke-width="3" stroke-linecap="round" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+(c*(1-v)).toFixed(1)+'"/></svg></span>'+
          '<span style="font-size:11.5px;color:var(--text-2);flex:1;min-width:0">'+x[0]+'</span>'+pill(x[1],x[2])+'</div>'; }).join('')+'</div></div>'+
      '<div class="card" style="padding:14px 16px;margin-top:12px"><div style="font-size:12.5px;font-weight:700;color:var(--heading);margin-bottom:10px">مواعيد مهمة</div>'+
        '<div style="display:grid;gap:7px"><div style="display:flex;justify-content:space-between"><span style="font-size:11.5px;color:var(--text-2)">الاستحقاق</span><span style="font-size:11.5px;font-weight:700;color:var(--heading)" dir="ltr">'+esc(o.due)+'</span></div>'+
        '<div style="display:flex;justify-content:space-between"><span style="font-size:11.5px;color:var(--text-2)">استلام إنفاذ</span><span style="font-size:11.5px;font-weight:700;color:var(--heading)" dir="ltr">23/07/2026</span></div></div></div>';
    var html =
      '<button class="back-link" data-back-props="'+esc(poId)+'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg><span>عقارات '+esc(o.po)+'</span></button>'+
      '<div class="card" style="padding:16px 20px 0;margin-bottom:14px">'+
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">'+
          '<div style="min-width:0;flex:1">'+
            '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-3);margin-bottom:5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>عقار '+p.idx+' من '+o.count+' في '+esc(o.po)+'</div>'+
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:19px;font-weight:700;color:var(--heading)">صك رقم <bdi dir="ltr">'+esc(p.deed)+'</bdi></span>'+
              '<span style="font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:6px;background:color-mix(in srgb,#2a8f8f 12%,transparent);color:#1f6f6f;border:1px solid color-mix(in srgb,#2a8f8f 28%,transparent)">صك ملكية</span>'+
              '<span style="font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:6px;background:color-mix(in srgb,#d9a441 14%,transparent);color:#8a5e14;border:1px solid color-mix(in srgb,#d9a441 32%,transparent)">'+esc(o.type||'تنفيذ')+'</span>'+
              '<span class="pp-badge" style="background:color-mix(in srgb,'+ps.c+' 15%,transparent);color:'+ps.c+'">'+ps.t+'</span></div>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:18px;flex:none">'+
            '<div style="text-align:start"><div style="font-size:11px;color:var(--text-3);margin-bottom:2px">رقم الطلب</div><div style="font-size:21px;font-weight:700;color:var(--gold-d)"><bdi dir="ltr">'+esc(p.request||'—')+'</bdi></div></div>'+
            (function(){ var ST=[['البيانات الأساسية',1],['مستندات العقار',1],['معاينة العقار',.5],['التقرير المساحي',.5],['المراجعات الحكومية',0],['مفاتيح العقار',1],['تقييم العقار',0],['دراسة العقار',0],['الرفع على إنفاذ',0]];
              var pct=Math.round(ST.reduce(function(a,b){return a+b[1];},0)/ST.length*100); var C=2*Math.PI*20;
              return '<div title="اكتمال دراسة حالة العقار — '+ST.filter(function(s){return s[1]===1;}).length+' من '+ST.length+' مرحلة مكتملة" style="display:flex;flex-direction:column;align-items:center;gap:3px"><div style="position:relative;width:50px;height:50px"><svg width="50" height="50" viewBox="0 0 50 50" style="transform:rotate(-90deg)"><circle cx="25" cy="25" r="20" fill="none" stroke="var(--border)" stroke-width="5"/><circle cx="25" cy="25" r="20" fill="none" stroke="var(--gold)" stroke-width="5" stroke-linecap="round" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+(C*(1-pct/100)).toFixed(1)+'"/></svg>'+
                '<span style="position:absolute;inset:0;display:grid;place-items:center;font-size:12px;font-weight:800;color:var(--heading)" dir="ltr">'+pct+'%</span></div>'+
                '</div>'; })()+
          '</div>'+
        '</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:0;margin-top:12px;padding-bottom:12px;border-bottom:1px solid var(--border)">'+
          '<div style="min-width:0;padding:4px 0;padding-inline-end:22px"><div style="font-size:11px;color:var(--text-3);margin-bottom:2px">اسم المالك</div><div style="font-size:13px;font-weight:600;color:var(--text)">'+esc(p.owner||'—')+'</div></div>'+
          stripCell('المدينة / الحي',esc(locTxt))+stripCell('التصنيف',esc(p.cls||'—'))+stripCell('المساحة',esc(areaTxt))+stripCell('المحكمة / الدائرة',esc(courtTxt))+stripCell('تاريخ الاستحقاق',esc(o.due),1)+stripCell('استلام إنفاذ','23/07/2026',1)+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:11px 0">'+
          '<span style="font-size:11px;color:var(--text-3);font-weight:600">الصفحة للاطلاع — الإجراءات حسب صلاحيات دورك:</span>'+
          '<button class="primary" data-pd-act="casestudy" style="padding:6px 14px;font-size:11.5px">فتح دراسة الحالة</button>'+
          '<button data-pd-act="edit" style="padding:6px 14px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">تعديل العقار</button>'+
          '<button data-pd-act="inspect" style="padding:6px 14px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">معاينة العقار</button>'+
          '<button data-pd-act="survey" style="padding:6px 14px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">رفع التقرير المساحي</button>'+
          '<button data-pd-act="appraise" style="padding:6px 14px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">رفع تقييم</button>'+
          '<span style="flex:1"></span>'+
          '<button data-pd-act="newtask" style="padding:6px 14px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>إنشاء مهمة</button>'+
        '</div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:14px;align-items:start">'+
        '<div class="card" style="padding:0 20px 20px">'+
          '<div class="tabs" style="margin:0 -20px;padding:0 14px;border-bottom:1px solid var(--border);flex-wrap:wrap;white-space:nowrap;row-gap:0;column-gap:2px">'+tabs.map(function(t,i){ return '<button class="tab'+(i===0?' on':'')+(pdNew.indexOf(t[0])>-1?' hasnew':'')+'" data-tab="'+i+'" style="padding:9px 10px;font-size:12.5px">'+t[1]+'</button>'; }).join('')+'</div>'+
          '<div id="pdPanel">'+tabs[0][2]+'</div>'+
        '</div>'+
        '<div>'+rail+'</div>'+
      '</div>';
    var v = document.getElementById('view-property');
    v.innerHTML = html;
    v.querySelectorAll('.tab').forEach(function(tb){
      tb.addEventListener('click', function(){
        v.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('on'); });
        tb.classList.add('on');
        tb.classList.remove('hasnew');
        var nk=tabs[+tb.getAttribute('data-tab')][0], nix=pdNew.indexOf(nk); if(nix>-1) pdNew.splice(nix,1);
        document.getElementById('pdPanel').innerHTML = tabs[+tb.getAttribute('data-tab')][2];
        pdBindNotes(v);
      });
    });
    v.addEventListener('click', function(e){
      var addob=e.target.closest('[data-ins-addobs]'); if(addob){ var list=document.getElementById('insObsList'); if(list){ var row=document.createElement('div'); row.style.cssText='display:flex;gap:10px;align-items:stretch;background:var(--surface);border:1.5px dashed var(--gold-d);border-radius:8px;padding:9px'; row.setAttribute('data-ins-obrow',''); row.innerHTML='<button type="button" data-ins-obphoto style="flex:none;width:74px;border-radius:6px;border:1px dashed var(--border-2);background:var(--surface-2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;font-family:inherit;color:var(--gold-d)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-2 4 4"/></svg><span style="font-size:9px">صورة إثبات</span></button>'+'<div style="min-width:0;flex:1;display:grid;gap:7px"><select style="appearance:none;padding:6px 10px;border:1px solid var(--border-2);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;font-family:inherit"><option>عيب ظاهر</option><option>ميزة</option><option>حالة البناء</option><option>المحيط والجوار</option><option>الخدمات</option><option>الحدود</option><option>أخرى</option></select><input placeholder="اشرح الملاحظة… مثل: يوجد هبوط في أرضيات الحوش" style="width:100%;padding:8px 11px;border:1px solid var(--border-2);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;font-family:inherit" /></div>'+'<button type="button" data-ins-obdel style="flex:none;width:30px;align-self:start;height:30px;border-radius:6px;border:1px solid var(--border-2);background:var(--surface);color:#d9694f;cursor:pointer;display:grid;place-items:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'; list.appendChild(row); var inp=row.querySelector('input'); if(inp) inp.focus(); } return; }
      var obdel=e.target.closest('[data-ins-obdel]'); if(obdel){ var orow=obdel.closest('[data-ins-obrow]')||obdel.closest('div[style*="dashed"]'); if(orow) orow.remove(); return; }
      var obph=e.target.closest('[data-ins-obphoto]'); if(obph){ showToast('فتح الكاميرا لالتقاط صورة الإثبات…'); return; }
      var bopt=e.target.closest('[data-ins-bopt]'); if(bopt){ var brow=bopt.closest('[data-ins-bound]'); var isMatch=bopt.getAttribute('data-ins-bopt')==='match'; brow.querySelectorAll('[data-ins-bopt]').forEach(function(x){ var m=x.getAttribute('data-ins-bopt')==='match'; var col=m?'#1f6f6f':'#d9694f'; x.style.borderColor='var(--border-2)'; x.style.background='var(--surface)'; x.style.color='var(--text-2)'; }); var col=isMatch?'#1f6f6f':'#d9694f'; bopt.style.borderColor=col; bopt.style.background='color-mix(in srgb,'+col+' 12%,transparent)'; bopt.style.color=col; var note=brow.querySelector('[data-ins-bnote]'); if(note) note.style.display=isMatch?'none':'block'; return; }
      var b=e.target.closest('[data-pd-act]'); if(!b) return;
      var act=b.getAttribute('data-pd-act');
      if(act==='newtask'){ renderTaskNew({po:poId, deeds:[p.deed], scope:'transaction'}); return; }
      if(act==='coord-copy'){ var blkC=b.closest('[data-coord-blk]'); var dec=blkC.querySelector('[data-coord-dec]').textContent; if(navigator.clipboard) navigator.clipboard.writeText(dec); showToast('تم نسخ الإحداثيات'); return; }
      if(act==='coord-edit'){ var blkE=b.closest('[data-coord-blk]'); blkE.querySelector('[data-coord-view]').style.display='none'; blkE.querySelector('[data-coord-form]').style.display='block'; return; }
      if(act==='coord-cancel'){ var blkX=b.closest('[data-coord-blk]'); blkX.querySelector('[data-coord-form]').style.display='none'; blkX.querySelector('[data-coord-view]').style.display='flex'; blkX.querySelector('[data-coord-lat]').value=GEO[0].toFixed(6); blkX.querySelector('[data-coord-lng]').value=GEO[1].toFixed(6); return; }
      if(act==='coord-save'){ var blkS=b.closest('[data-coord-blk]'); var la=parseFloat(blkS.querySelector('[data-coord-lat]').value); var ln=parseFloat(blkS.querySelector('[data-coord-lng]').value); if(isNaN(la)||isNaN(ln)||la<-90||la>90||ln<-180||ln>180){ showToast('قيمة إحداثيات غير صحيحة — تحقق من خط العرض/الطول.'); return; } GEO[0]=la; GEO[1]=ln; p._geo=[la,ln]; blkS.querySelector('[data-coord-dms]').textContent=dms(la,'N','S')+' '+dms(ln,'E','W'); blkS.querySelector('[data-coord-dec]').textContent=la.toFixed(6)+', '+ln.toFixed(6); var mp=v.querySelector('[data-pd-map]'); if(mp){ mp.src='https://www.openstreetmap.org/export/embed.html?bbox='+(ln-0.006).toFixed(5)+'%2C'+(la-0.004).toFixed(5)+'%2C'+(ln+0.006).toFixed(5)+'%2C'+(la+0.004).toFixed(5)+'&layer=mapnik&marker='+la+'%2C'+ln; } blkS.querySelector('[data-coord-form]').style.display='none'; blkS.querySelector('[data-coord-view]').style.display='flex'; showToast('تم تحديث الإحداثيات يدوياً.'); return; }      if(act==='inspect-return'){ showToast('إعادة مهمة المعاينة للتصحيح — أدخل سبب الإرجاع في مساحة المعاين.'); return; }
      if(act==='photospdf'){ showToast('يجري تجهيز ملف PDF بصور العقار للتنزيل…'); return; }
      if(act==='edit'){ showToast('تعديل العقار — متاح لأخصائي دراسة الحالة فقط.'); return; }
      if(act==='inspect'){ renderInspectChooser(p,o); return; }
      if(act==='inspect-mobile'){ var mc=document.getElementById('miChooser'); if(mc) mc.remove(); renderInspectMobile(p,o); return; }
      if(act==='inspect-desktop'){ var dc=document.getElementById('miChooser'); if(dc) dc.remove(); var it=v.querySelector('.tab[data-tab="'+tabs.map(function(t){return t[0];}).indexOf('p-inspector')+'"]'); if(it){ v.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('on'); }); it.classList.add('on'); it.classList.remove('hasnew'); } document.getElementById('pdPanel').innerHTML = pdInspectionHtml(p,o,true); document.getElementById('pdPanel').scrollIntoView&&0; return; }
      if(act==='inspect-edit'){ document.getElementById('pdPanel').innerHTML = pdInspectionHtml(p,o,true); return; }
      if(act==='inspect-view'){ document.getElementById('pdPanel').innerHTML = pdInspectionHtml(p,o,false); return; }
      if(act==='inspect-save'){ document.getElementById('pdPanel').innerHTML = pdInspectionHtml(p,o,false); showToast('تم حفظ بيانات المعاينة وإرسالها.'); return; }
      if(act==='survey'){ renderEngSurvey(ENG_OFFICE,'survey','work',false,p.deed,o.po,false,''); return; }
      if(act==='appraise'){ var vt=VAL_TASKS.find(function(x){ return x.deed===p.deed; })||VAL_TASKS[0]; renderValWin(vt.id,'valuation'); return; }
    });
    setHeader('تفاصيل العقار', crumb(['أوامر العمل','عقارات ' + o.po,'العقار']));
    navActive('أوامر العمل (PO)');
    showView('property');
  }

  