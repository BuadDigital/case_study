function taskDueLabel(ts){
    var d=new Date(ts), h=d.getHours(), h12=h%12||12;
    return WEEKDAYS[d.getDay()]+' '+pad2(d.getDate())+'/'+pad2(d.getMonth()+1)+' · '+h12+':'+pad2(d.getMinutes())+' '+(h<12?'ص':'م');
  }