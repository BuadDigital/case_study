function renderClosePend(){
    var el=document.getElementById('closePend'); if(!el) return;
    el.innerHTML = CLOSEDRAFT.files.length ? '<div class="cmt-files" style="margin-top:11px">'+CLOSEDRAFT.files.map(function(f,i){ return fileChip(f,i,'close-rmfile'); }).join('')+'</div>' : '';
  }