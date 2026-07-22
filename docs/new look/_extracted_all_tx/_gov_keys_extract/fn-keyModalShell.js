function keyModalShell(title, bodyHtml, saveLabel){
    var ov=document.createElement('div'); ov.className='modal-overlay'; ov.id='keyModalOverlay';
    ov.innerHTML='<div class="modal"><div class="modal-head"><h2>'+esc(title)+'</h2><button class="modal-x" data-key-mclose type="button">✕</button></div>'+
      '<div class="modal-body"><div class="modal-error" id="keyErr" hidden></div>'+bodyHtml+'</div>'+
      '<div class="modal-foot"><button class="btn-ghost" data-key-mclose type="button">إلغاء</button><button class="primary" id="keySaveBtn" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span>'+esc(saveLabel)+'</span></button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){ if(e.target===ov||e.target.closest('[data-key-mclose]')) keyCloseModal(); });
    setTimeout(function(){ var f=ov.querySelector('input,select,textarea'); if(f) f.focus(); },40);
    return ov;
  }