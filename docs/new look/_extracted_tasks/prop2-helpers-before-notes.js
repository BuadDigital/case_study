var PD_ME='أخصائي دراسة الحالة';
  var PD_NOTES={};
  function pdNotesFor(deed){
    if(!PD_NOTES[deed]) PD_NOTES[deed]=[
      {who:'المعاين',at:'2026/07/19 · 09:20',txt:'العقار مسوّر ويصعب الوصول للواجهة الخلفية — طُلب تنسيق مع الحارس قبل الزيارة القادمة.',replies:[
        {who:'أخصائي دراسة الحالة',at:'2026/07/19 · 12:10',txt:'تم التواصل مع المنسق لترتيب دخول يوم الأحد.'}]},
      {who:'المكتب الهندسي',at:'2026/07/21 · 11:05',txt:'الإحداثيات المسلّمة لا تطابق حدود الصك في الضلع الشمالي بفارق 1.8 م — بانتظار إفادة مركز الإسناد.',replies:[
        {who:'مركز الإسناد والتصفية',at:'2026/07/22 · 08:35',txt:'أُرسل طلب استيضاح للمحكمة، والرد خلال يومي عمل.'}]},
      {who:'المراجع الحكومي',at:'2026/07/23 · 14:40',txt:'لا توجد قيود على الصك حتى تاريخه، وتم التحقق من عدم وجود رهن.',replies:[]}
    ];
    return PD_NOTES[deed];
  }
  function pdAva(n){ return '<span style="flex:none;width:26px;height:26px;border-radius:99px;display:grid;place-items:center;background:var(--ink);color:var(--gold-2);font-size:11px;font-weight:700">'+esc(String(n).trim().charAt(0))+'</span>'; }
  