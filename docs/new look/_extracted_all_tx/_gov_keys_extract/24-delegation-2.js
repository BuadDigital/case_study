olumns:'+cols+'"><div class="th c"><input type="checkbox" id="tkSelAll" aria-label="تحديد الكل"></div><div class="th">المهمة</div><div class="th">النطاق / الربط</div><div class="th">المنفّذ</div><div class="th">الاستحقاق</div><div class="th">الحالة</div><div class="th c">إجراءات</div></div>'+
        '<div id="tkRows"></div></div></div>'+
        '<div style="padding:11px 16px;border-top:1px solid var(--border);font-size:12px;color:var(--text-3)">اضغط الصف لعرض تفاصيل المهمة. المراجعة الحكومية وخطاب التفويض حالتان من هذه الطبقة.</div>'+
      '</div>';
    var draw=function(){
      var q=TASK_STATE.search.trim();
      var rows=TASKS.filter(function(t){
        var okQ=!q||(t.title+' '+asgName(t.assignee)+' '+(t.deeds?t.deeds.join(' '):'')+' '+(t.po||'')+' '+t.id).indexOf(q)!==-1;
       