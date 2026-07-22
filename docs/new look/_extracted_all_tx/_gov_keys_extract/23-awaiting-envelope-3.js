justify-content:flex-start">حالة المفاتيح</div><div class="th" style="justify-content:flex-start">بوابة الظرف</div><div class="th">إجراء</div></div>'+
        (list.length?rows:'<div class="empty"><div class="t">لا توجد عقارات مسجّلة بعد</div></div>')+
      '</div></div></div>'+
      '<p style="font-size:11.5px;color:var(--text-3);padding:12px 4px 0">الإنهاء لا يُمنع عند غياب الظرف — تبقى شارة «بانتظار الظرف» وتتم مزامنة ناعمة مع الظرف إن وُجد.</p>';
    var v=document.getElementById('view-govReview'); v.innerHTML=html;
    v.querySelectorAll('[data-gov-ks]').forEach(function(s){ s.addEventListener('change',function(){ var x=govProps()[+s.getAttribute('data-gov-ks')]; if(x){ x.p._keysStatus=s.value; renderGovReview(); } }); });
    var gb=document.getElementById('govRegBtn'); if(gb) gb.a