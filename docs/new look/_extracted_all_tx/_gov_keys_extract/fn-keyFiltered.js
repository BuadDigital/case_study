function keyFiltered(){
    var q=KEY_STATE.search.trim();
    return KEY_ENV.filter(function(e){
      if(e.id.indexOf('ENVP-')===0) return false;
      var deeds=e.assignments.map(function(a){return a.deed;}).join(' ');
      var okQ=!q||(keyRef(e)+' '+e.request+' '+e.court+' '+e.circuit+' '+deeds).indexOf(q)>=0;
      var okSc=KEY_STATE.scenario==='all'||e.scenario===KEY_STATE.scenario;
      var okSt=KEY_STATE.status==='all'||e.status===KEY_STATE.status;
      var okOut=KEY_STATE.showOut||KEY_STATE.status!=='all'||(e.status!=='returned'&&e.status!=='external');
      return okQ&&okSc&&okSt&&okOut;
    });
  }