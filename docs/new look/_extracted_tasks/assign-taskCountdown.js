function taskCountdown(t){
    if(t.status==='paused') return { txt:'متوقفة', over:false };
    if(TASK_TERMINAL[t.status]) return { txt:'—', over:false };
    var diff=t.dueAt - taskLive(), over=diff<0; if(over) diff=-diff;
    var d=Math.floor(diff/DAY), h=Math.floor((diff%DAY)/3600000), m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000);
    var hms='<span dir="ltr">'+pad2(h)+':'+pad2(m)+':'+pad2(s)+'</span>';
    var dayPart = d>0 ? d+(d===1?' يوم':(d===2?' يومان':' أيام'))+' · ' : '';
    return { txt:(over?'متأخرة · ':'')+dayPart+hms, over:over };
  }