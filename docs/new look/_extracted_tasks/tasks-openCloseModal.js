function openCloseModal(id){
    var t=TASKS.find(function(x){ return x.id===id; }); if(!t) return;
    CLOSEDRAFT={ files:[] }; removeCloseModal();
    var ov=document.createElement('div'); ov.id='closeModalOverlay'; ov.className='modal-overlay';
    ov.innerHTML='<div class="modal" role="dialog" aria-modal="true" style="max-width:540px">'+
      '<div class="modal-head"><div><h2>إغلاق المهمة</h2><div style="font-size:11.5px;color:var(--text-3);margin-top:3px">أضف تعليق الإنجاز مع إمكانية إرفاق المستندات الداعمة</div></div><button class="modal-x" data-close-cancel aria-label="إغلاق">✕</button></div>'+
      '<div class="modal-body">'+
        '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:11px 13px;font-size:12.5px;color:var(--text-2);margin-bottom:14px">سيتم تحويل حالة المهمة إلى <b style="color:#2f7a4d">مكتملة</b> وإشعار المنشئ.</div>'+
        '<label class="tf-lbl">تعليق الإغلاق</label><textarea id="closeNote" rows="3" placeholder="لخّص ما تم إنجازه…" style="width:100%;font-family:inherit;padding:11px 13px;border:1px solid var(--border-2);border-radius:10px;background:var(--surface-2);color:var(--text);font-size:13px;outline:none;resize:vertical"></textarea>'+
        '<div id="closePend"></div>'+
        '<button type="button" class="attach-btn" data-close-attach style="margin-top:11px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49"/></svg><span>إرفاق مستند</span></button><input type="file" id="closeFile" multiple hidden>'+
      '</div>'+
      '<div class="modal-foot"><button class="btn-ghost" data-close-cancel>إلغاء</button><button class="primary" data-close-confirm="'+esc(id)+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span>إغلاق المهمة</span></button></div>'+
    '</div>';
    document.body.appendChild(ov);
    document.getElementById('closeFile').addEventListener('change', function(e){ Array.from(e.target.files).forEach(function(f){ CLOSEDRAFT.files.push({name:f.name,size:fmtSize(f.size)}); }); renderClosePend(); });
    setTimeout(function(){ var n=document.getElementById('closeNote'); if(n) n.focus(); }, 40);
  }