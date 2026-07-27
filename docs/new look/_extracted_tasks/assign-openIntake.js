function openIntake(){
    clearErrs();
    Object.keys(F).forEach(function(k){ var el=document.getElementById(F[k]); if(el) el.value = (k==='count'?'1':''); });
    ov.hidden = false;
    setTimeout(function(){ document.getElementById('f_po').focus(); }, 40);
  }