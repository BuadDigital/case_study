function renderKeys(){
    var total=KEY_ENV.filter(function(e){return e.id.indexOf('ENVP-')!==0;});
    function envOrderState(e){
      var linked=ORDERS.filter(function(o){ return genProps(o).some(function(p){return p.registered&&p.request===e.request;}); });
      if(!linked.length) return 'none';
      return linked.every(function(o){return TERMINAL[o.status];}) ? 'done' : 'progress';
    }
    var inProgN=total.filter(function(e){ return envOrderState(e)!=='done'; }).length;
    var doneHeldN=total.filter(function(e){ return envOrderState(e)==='done' && e.status!=='returned'; }).length;
    var pendingN=total.reduce(function(n,e){ return n+e.assignments.filter(function(a){return a.status==='pending';}).length; },0);
    var COLS='minmax(105px,.9fr) minmax(150px,1.4fr) 92px minmax(110px,1fr) 72px minmax(118px,1fr) minmax(120px,1fr) 44px';
    var kpiIco=function(bg,col,path){ return '<span class="kpi-ico" style="background:'+bg+';color:'+col+'"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg></span>'; };
    var html=
      '<div class="kpi">'+
        '<div class="first"><div class="kpi-head">'+kpiIco('var(--gold-soft)','var(--gold-d)',ICO_ENV)+'<span>إجمالي الأظرف</span></div><div class="kpi-num">'+total.length+'</div><div class="kpi-sub"><span class="g"></span>'+total.filter(function(e){return e.status==='returned'||e.status==='external';}).length+' مسلَّمة · المتبقي في العهدة <b style="color:var(--gold-d);font-size:12.5px">'+(total.length-total.filter(function(e){return e.status==='returned'||e.status==='external';}).length)+'</b></div></div>'+
        '<div><div class="kpi-head">'+kpiIco('color-mix(in srgb,#378add 15%,transparent)','#378add','<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>')+'<span>الأظرف النشطة</span></div><div class="kpi-num">'+inProgN+'</div><div class="kpi-sub">لها معاملات لم تكتمل في النظام</div></div>'+
        '<div><div class="kpi-head">'+kpiIco('color-mix(in srgb,#d9a441 20%,transparent)','#8a5e14','<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>')+'<span>بانتظار المطابقة الميدانية</span></div><div class="kpi-num">'+pendingN+'</div><div class="kpi-sub">صكوك لم تُجرَّب مفاتيحها</div></div>'+
        '<div><div class="kpi-head">'+kpiIco('color-mix(in srgb,#d9694f 16%,transparent)','#c0553d','<path d="M22 7 12 13 2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 13v4"/>')+'<span>أظرف جاهزة للتسليم</span></div><div class="kpi-num">'+doneHeldN+'</div><div class="kpi-sub">اكتملت معاملاتها — بانتظار الإرجاع أو التسليم</div></div>'+
      '</div>'+
      '<div class="toolbar">'+
        '<div style="display:flex;align-items:center;gap:10px"><h2>ظروف المفاتيح</h2><span class="chip" id="keyChip">'+total.length+' نتيجة</span></div>'+
        '<div class="filters">'+
          '<div class="search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input id="keySearch" type="text" placeholder="رقم الطلب أو المحكمة أو الصك..." /></div>'+
          '<button class="ghost-btn" id="keyOutTgl" style="height:38px;padding:0 14px;font-size:12.5px;gap:7px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" id="keyOutIco"></svg><span id="keyOutTxt"></span></button>'+
          '<div class="sel"><select id="keyStatSel"><option value="all">كل حالات العهدة</option><option value="reviewer">بعهدة المراجع</option><option value="assessor">بعهدة المعاين</option><option value="external">بعهدة طرف خارجي</option><option value="returned">مُرجَع للمحكمة</option></select><span class="caret"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></div>'+
          '<button class="primary" id="keyNewBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg><span>تسجيل ظرف مفاتيح</span></button>'+
        '</div>'+
      '</div>'+
      '<div class="card"><div class="scroll"><div class="grid" style="min-width:960px">'+
        '<div class="thead" style="grid-template-columns:'+COLS+'">'+
          '<div class="th" style="justify-content:flex-start">الرقم المرجعي</div>'+
          '<div class="th" style="justify-content:flex-start">المحكمة / الدائرة</div>'+
          '<div class="th">عدد المفاتيح</div>'+
          '<div class="th" style="justify-content:flex-start">رقم الطلب</div>'+
          '<div class="th">الصكوك</div>'+
          '<div class="th" style="justify-content:flex-start">سيناريو الاستلام</div>'+
          '<div class="th" style="justify-content:flex-start">العهدة</div>'+
          '<div class="th"></div>'+
        '</div>'+
        '<div id="keyRows"></div>'+
      '</div></div></div>';
    var v=document.getElementById('view-keys'); v.innerHTML=html;
    keyDrawList();
    var si=document.getElementById('keySearch'); if(si){ si.value=KEY_STATE.search; si.addEventListener('input',function(e){ KEY_STATE.search=e.target.value; keyDrawList(); }); }
    var st=document.getElementById('keyStatSel'); if(st){ st.value=KEY_STATE.status; st.addEventListener('change',function(e){ KEY_STATE.status=e.target.value; keyDrawList(); }); }
    var nb=document.getElementById('keyNewBtn'); if(nb){ nb.addEventListener('click',openKeyRegister); }
    var ot=document.getElementById('keyOutTgl');
    if(ot){
      var eyeOn='<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';
      var eyeOff='<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61"/><path d="M2 2l20 20"/>';
      var paint=function(){ document.getElementById('keyOutIco').innerHTML=KEY_STATE.showOut?eyeOn:eyeOff; document.getElementById('keyOutTxt').textContent=KEY_STATE.showOut?'إخفاء المسلَّمة (خارج العهدة)':'إظهار المسلَّمة (خارج العهدة)'; };
      paint();
      ot.addEventListener('click',function(){ KEY_STATE.showOut=!KEY_STATE.showOut; paint(); keyDrawList(); });
    }
    setHeader('محفظة المفاتيح', crumb(['لوحة التحكم','دراسة الحالة','محفظة المفاتيح']));
    navActive('إدارة المفاتيح');
    showView('keys');
  }
