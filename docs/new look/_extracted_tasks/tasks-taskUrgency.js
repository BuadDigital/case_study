function taskUrgency(t){
    if(!taskActive(t)) return null;
    var diff=t.dueAt - taskLive();
    if(diff <= 2*3600000) return { c:'#d9694f', pulse:true };
    if(diff <= 8*3600000) return { c:'#d9a441', pulse:false };
    return { c:'#3f8f5f', pulse:false };
  }