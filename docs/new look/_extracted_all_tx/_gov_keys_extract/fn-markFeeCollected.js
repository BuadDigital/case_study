function markFeeCollected(env){
    env.feeState='collected';
    env.timeline.push({ev:'fee',date:keyToday().dt,detail:'تعليم بند الأتعاب ('+env.feeAmount+' ر.س) كمحصّل'});
    renderKeyDetail(env.id); showToast('تم تعليم أتعاب الظرف '+env.request+' كمحصّلة.');
  }