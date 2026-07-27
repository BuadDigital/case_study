function openReqs(){
      var used={}; KEY_ENV.forEach(function(x){ used[x.request]=1; });
      var out=[], seen={};
      ORDERS.forEach(function(o){ if(TERMINAL[o.status]) return; genProps(o).forEach(function(p){ if(p.registered&&p.request&&!used[p.request]){ if(!seen[p.request]){ seen[p.request]={request:p.request,court:p.court,circuit:p.circuit,deeds:[],p:p,o:o}; out.push(seen[p.request]); } seen[p.request].deeds.push(p.deed); } }); });
      return out;
    }