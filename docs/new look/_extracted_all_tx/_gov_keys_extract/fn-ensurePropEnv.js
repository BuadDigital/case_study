function ensurePropEnv(p,o){
    if(p._env) return p._env;
    var st = p.status==='done'||p.status==='fail' ? 'assessor':'reviewer';
    var asg = p.status==='done'?'matched':(p.status==='fail'?'unmatched':'pending');
    var mate = o.specialist || 'أيمن مجرشي';
    var env={ id:'ENVP-'+p.id, request:p.request||'—', court:p.court||'محكمة التنفيذ', circuit:p.circuit||'—',
      labeled:1, actual:1, scenario:'court', status:st, fee:true, feeAmount:350, created:o.received, contact:'',
      attachments:[{k:'receipt'},{k:'photo'}],
      assignments:[{deed:p.deed, property:(p.city?p.city+' · '+p.district:'العقار'), status:asg, note:asg==='matched'?'فُتح الباب بنجاح':asg==='unmatched'?'المفتاح لا يطابق القفل':'بانتظار التجربة الميدانية'}],
      handoffs: st==='assessor'?[{type:'internal',state:'confirmed',person:mate,role:'معاين ميداني',date:o.received,letter:''}]:[],
      timeline:[
        {ev:'created',date:o.received,detail:'استلام الظرف من '+(p.court||'المحكمة')+' وتسجيله برقم الطلب '+(p.request||'—')},
        {ev:'fee',date:o.received,detail:'توليد بند أتعاب استلام مفاتيح (350 ر.س)'},
        {ev:'assign',date:o.received,detail:'إسناد المفتاح مبدئياً للصك '+p.deed} ]
        .concat(st==='assessor'?[{ev:'handoff',date:o.received,detail:'تسليم داخلي للمعاين '+mate+' وتأكيد استلامه'}]:[])
        .concat(asg==='matched'?[{ev:'confirm',date:o.received,detail:'تجربة ميدانية ناجحة — المفتاح مطابق للقفل'}]:asg==='unmatched'?[{ev:'confirm',date:o.received,detail:'تجربة ميدانية: المفتاح غير مطابق — يلزم مسار بديل'}]:[]) };
    KEY_ENV.push(env); p._env=env; return env;
  }