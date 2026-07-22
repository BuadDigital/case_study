function govProps(){
    var out=[];
    ORDERS.forEach(function(o){ genProps(o).forEach(function(p){ if(p.registered) out.push({p:p,o:o}); }); });
    return out;
  }