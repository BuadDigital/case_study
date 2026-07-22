function govSetUser(kind){
    var b=document.querySelector('.user b'), r=document.querySelector('.user span'), av=document.querySelector('.user .avatar');
    if(kind==='gov'){ b.textContent='مشعل'; r.textContent='مراجع حكومي'; av.textContent='م'; av.style.background='var(--gold-d)'; av.style.color='#fff'; renderGovReview(); showToast('تم التبديل إلى دور المراجع الحكومي — مشعل.'); }
    else { b.textContent='سليمان'; r.textContent='المسؤول'; av.textContent='س'; av.style.background=''; av.style.color=''; showToast('تم التبديل إلى دور المسؤول — سليمان.'); }
    document.querySelector('.user-menu').classList.remove('open');
  }
