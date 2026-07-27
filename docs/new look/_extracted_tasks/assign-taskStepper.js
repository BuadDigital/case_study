function taskStepper(t){
    var who=function(n){ if(!n) return ''; n=(''+n).split(' — ')[0]; return '<span style="display:block;font-size:10.5px;color:var(--text-3);font-weight:600;margin-top:1px">'+esc(n)+'</span>'; };
    if(t.status==='cancelled'){
      return '<div class="step-flow"><div class="step done"><span class="step-dot">✓</span><span class="step-lbl">منشأة</span></div><div class="step-line"></div><div class="step cancel"><span class="step-dot">✕</span><span class="step-lbl">ملغاة</span></div></div>';
    }
    var idx={in_progress:1,paused:1,completed:2}[t.status]||1;
    var steps=[['منشأة',''],['قيد التنفيذ',''],['مكتملة','']];
    return '<div class="step-flow">'+steps.map(function(s,i){
      var cls=i<idx?'done':(i===idx?'active':'');
      var dot=i<idx?'✓':(i+1);
      var line=i<steps.length-1?'<div class="step-line'+(i<idx?' on':'')+'"></div>':'';
      return '<div class="step '+cls+'" style="align-items:flex-start"><span class="step-dot">'+dot+'</span><span class="step-lbl">'+s[0]+who(i<=idx?s[1]:'')+'</span></div>'+line;
    }).join('')+'</div>';
  }