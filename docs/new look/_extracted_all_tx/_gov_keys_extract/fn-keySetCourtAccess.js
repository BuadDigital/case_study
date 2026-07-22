function keySetCourtAccess(po,propId,val){
    var o=ORDERS.find(function(x){return x.po===po;}); if(!o) return;
    var p=genProps(o).find(function(x){return x.id===propId;}); if(!p) return;
    p._court=val;
    var panel=document.getElementById('pdPanel'); if(panel) panel.innerHTML=keyPanelForProp(p,o);
    showToast(val==='enabled_no_key'?'تم تفعيل «تمكين بدون مفتاح».':val==='suspended_eviction'?'تم تسجيل «محظر إخلاء» — الدراسة معلّقة.':'تم مسح أثر مسار المحكمة.');
  }