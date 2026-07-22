function keyPersist(){
    try{ localStorage.setItem(KEY_LS, JSON.stringify(KEY_ENV.filter(function(e){return e._user;}))); }catch(_){}
  }
  (function(){
    try{
      var saved=JSON.parse(localStorage.getItem(KEY_LS)||'[]');
      saved.reverse().forEach(function(e){ if(!KEY_ENV.some(function(x){return x.id===e.id;})){ KEY_ENV.unshift(e);
        ORDERS.forEach(function(o){ genProps(o).forEach(function(p){ if(e.assignments.some(function(a){return a.deed===p.deed;})) p._env=e; }); }); } });
    }catch(_){}
  })();