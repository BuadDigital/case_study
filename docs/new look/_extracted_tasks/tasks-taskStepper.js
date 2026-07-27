function taskStepper(t){
    if(t.status==='cancelled'){
      return '<div class="step-flow"><div class="step done"><span class="step-dot">✓</span><span class="step-lbl">منشأة</span></div><div class="step-line"></div><div class="step cancel"><span class="step-dot">✕</span><span class="step-lbl">ملغاة</span></div></div>';
    }
    var idx={created:0,in_progress:1,completed:2}[t.status];
    var steps=[['منشأة'],['قيد التنفيذ'],['مكتملة']];
    return '<div class="step-flow">'+steps.map(function(s,i){
      var cls=i<idx?'done':(i===idx?'active':'');
      var dot=i<idx?'✓':(i+1);
      var line=i<steps.length-1?'<div class="step-line'+(i<idx?' on':'')+'"></div>':'';
      return '<div class="step '+cls+'"><span class="step-dot">'+dot+'</span><span class="step-lbl">'+s[0]+'</span></div>'+line;
    }).join('')+'</div>';
  }