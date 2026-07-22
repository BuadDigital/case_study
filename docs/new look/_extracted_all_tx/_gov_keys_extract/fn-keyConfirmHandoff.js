function keyConfirmHandoff(envId,i){
    var env=KEY_ENV.find(function(x){return x.id===envId;}); if(!env||!env.handoffs[i]) return;
    var h=env.handoffs[i]; h.state='confirmed'; env.status='assessor';
    env.timeline.push({ev:'handoff',date:keyToday().dt,detail:'تأكيد استلام المعاين '+h.person+' — الحالة: بعهدة المعاين'});
    renderKeyDetail(env.id); showToast('أكّد المعاين استلام الظرف '+env.request+'.');
  }