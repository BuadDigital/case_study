function openReopenModal(poId, propId){
    var o = ORDERS.find(function(x){ return x.po === poId; });
    var p = o ? genProps(o).find(function(x){ return x.id === propId; }) : null;
    var deed = p ? p.deed : '';
    var wrap = document.createElement('div');
    wrap.className = 'overlay open';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:200;display:grid;place-items:center;background:rgba(15,26,45,.55);backdrop-filter:blur(2px)';
    wrap.innerHTML =
      '<div class="modal" style="width:min(92vw,470px);background:var(--surface);border:1px solid var(--border-2);border-radius:16px;overflow:hidden;box-shadow:0 24px 60px -12px rgba(18,43,78,.4)">' +
        '<div style="display:flex;align-items:flex-start;gap:13px;padding:20px 22px 12px">' +
          '<span style="flex-shrink:0;width:40px;height:40px;border-radius:10px;display:grid;place-items:center;background:color-mix(in srgb,#d9694f 14%,transparent);color:#c0553d"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg></span>' +
          '<div style="flex:1"><h3 style="margin:0;font-size:16px;font-weight:800;color:var(--heading)">فتح المعاملة</h3>' +
            '<p style="margin:5px 0 0;font-size:12.5px;color:var(--text-2);line-height:1.7">إعادة فتح المعاملة المكتملة <span dir="ltr" style="font-weight:700;color:var(--gold-d)">صك ' + esc(deed) + '</span> لإكمال بعض النواقص أو التعديل عليها. ستعود المعاملة إلى حالة «قيد العمل».</p></div>' +
        '</div>' +
        '<div style="margin:4px 22px 0;padding:11px 13px;border-radius:10px;background:color-mix(in srgb,#d9a441 12%,transparent);display:flex;gap:9px;align-items:flex-start">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a67c1a" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>' +
          '<span style="font-size:11.5px;color:#8a6a18;font-weight:600;line-height:1.6">هذا الإجراء يتطلب صلاحية من مستوى عالٍ (مشرف دراسة الحالة فأعلى) وسيُسجَّل في سجل التدقيق.</span>' +
        '</div>' +
        '<div style="padding:8px 22px 0"><label style="font-size:12px;font-weight:600;color:var(--text-2);display:block;margin-bottom:5px">سبب إعادة الفتح</label>' +
          '<textarea id="reopenReason" rows="2" placeholder="مثال: استكمال صورة المعاينة المفقودة" style="width:100%;font-family:inherit;padding:9px 12px;border:1px solid var(--border-2);border-radius:9px;background:var(--surface-2);color:var(--text);font-size:13px;outline:none;resize:vertical"></textarea></div>' +
        '<div class="modal-foot" style="display:flex;justify-content:flex-end;gap:10px;padding:16px 22px;margin-top:12px;border-top:1px solid var(--border);background:var(--surface-2)">' +
          '<button class="btn-ghost" id="reopenCancel" style="padding:9px 16px;border:1px solid var(--border-2);border-radius:8px;background:var(--surface);color:var(--text-2);font-size:13px;font-weight:600;cursor:pointer">إلغاء</button>' +
          '<button class="primary" id="reopenConfirm" style="display:flex;align-items:center;gap:7px;padding:10px 16px;border:none;border-radius:8px;background:#c0553d;color:#fff;font-size:13px;font-weight:700;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg><span>فتح المعاملة</span></button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    var close = function(){ wrap.remove(); };
    wrap.addEventListener('click', function(e){ if (e.target === wrap) close(); });
    wrap.querySelector('#reopenCancel').addEventListener('click', close);
    wrap.querySelector('#reopenConfirm').addEventListener('click', function(){
      if (p) p.status = 'progress';
      close();
      renderProperties(poId);
      showToast('تم فتح المعاملة صك ' + deed + ' — الحالة الآن «قيد العمل».');
    });
  }