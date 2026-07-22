function openKeyAssign(env){
    keyCloseModal();
    var body='<div class="form-grid">'+
      '<div class="fld full" data-f="deed"><label>رقم الصك *</label><input id="ka_deed" placeholder="3102...." /><span class="msg"></span></div>'+
      '<div class="fld full"><label>العقار (اختياري)</label><input id="ka_prop" placeholder="النوع — الحي" /></div>'+
      '<div class="fld full"><label>ملاحظة</label><input id="ka_note" placeholder="اختياري" /></div>'+
      '<div class="fld full"><div class="tf-note">الإسناد يُسجَّل بحالة «مبدئي» حتى يؤكّده المعاين ميدانياً (مطابق / غير مطابق).</div></div>'+
    '</div>';
    keyModalShell('إسناد صك للظرف — '+env.request, body, 'إضافة الإسناد');
    document.getElementById('keySaveBtn').addEventListener('click',function(){
      var deed=document.getElementById('ka_deed').value.trim();
      if(!deed){ keyErr('رقم الصك مطلوب.'); return; }
      var prop=document.getElementById('ka_prop').value.trim()||'—';
      var note=document.getElementById('ka_note').value.trim()||'—';
      env.assignments.push({deed:deed, property:prop, status:'pending', note:note});
      env.timeline.push({ev:'assign',date:keyToday().dt,detail:'إضافة إسناد مبدئي للصك '+deed});
      keyCloseModal(); renderKeyDetail(env.id); showToast('تمت إضافة إسناد الصك '+deed+' (مبدئي).');
    });
  }
