function openKeyFile(env,i){
    keyCloseModal();
    var a=env.assignments[i]; if(!a) return;
    var km=keyAssign(a.status);
    var lastInt=env.handoffs.filter(function(h){return h.type==='internal';}).slice(-1)[0];
    var lastExt=env.handoffs.filter(function(h){return h.type==='external';}).slice(-1)[0];
    var holder= env.status==='assessor'?(((lastInt||{}).person||'المعاين')+' — معاين ميداني'):env.status==='external'?(((lastExt||{}).person||'جهة خارجية')):env.status==='returned'?'المحكمة (مُرجَع)':'المراجع الحكومي';
    var card=function(k,v){ return '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:11px 13px"><div style="font-size:11px;color:var(--text-3);margin-bottom:4px">'+k+'</div><div style="font-size:13px;font-weight:800;color:var(--heading)">'+v+'</div></div>'; };
    var chainItems=[{c:'#378add',title:'تسجيل الظرف — بعهدة المراجع',date:env.created,detail:'المفتاح ضمن الظرف '+env.request}].concat(env.handoffs.map(function(h){ var m=keyHoType(h.type), s=keyHoState(h.state); return {c:m[1],title:m[0]+' — '+s[0],date:h.date,detail:h.person+' ('+h.role+')'+(h.letter?' — '+h.letter:'')}; }));
    var tlItems=env.timeline.filter(function(t){ return t.detail.indexOf(a.deed)>=0 || t.ev==='created' || t.ev==='handoff'; }).map(function(t){ var m=keyTlMeta(t.ev); return {c:m[1],title:m[0],date:t.date,detail:t.detail}; });
    var body=
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:16px">'+card('الظرف التابع له',esc(env.request))+card('العهدة الحالية',esc(holder))+card('حالة التجربة','<span style="color:'+km[1]+'">'+esc(km[0])+'</span>')+'</div>'+
      '<div style="font-size:12.5px;font-weight:800;color:var(--heading);margin-bottom:10px">سلسلة العهدة <span style="font-weight:600;color:var(--text-3);font-size:11px">(المناولة على مستوى الظرف كاملاً — والمفتاح يتحرك معه)</span></div>'+keyTimeline(chainItems)+
      '<div style="font-size:12.5px;font-weight:800;color:var(--heading);margin:6px 0 10px">السجل الزمني للمفتاح</div>'+keyTimeline(tlItems);
    keyModalShell('ملف المفتاح — صك '+a.deed, body, 'إغلاق');
    document.getElementById('keySaveBtn').addEventListener('click',keyCloseModal);
  }