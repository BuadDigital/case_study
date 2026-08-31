/** Mock courts and circuits — replace with supervisor-managed list. */
export const COURTS_BY_CITY: Record<
  string,
  { court: string; circuits: string[] }[]
> = {
  "مكة المكرمة": [
    {
      court: "محكمة التنفيذ بمكة المكرمة",
      circuits: ["الدائرة الأولى", "الدائرة الثانية"],
    },
    {
      court: "محكمة الاستئناف بمكة المكرمة",
      circuits: ["دائرة الأحوال"],
    },
  ],
  جدة: [
    {
      court: "محكمة التنفيذ بجدة",
      circuits: ["الدائرة الأولى", "الدائرة الثانية", "الدائرة الثالثة"],
    },
  ],
  الرياض: [
    {
      court: "محكمة التنفيذ بالرياض",
      circuits: ["الدائرة الأولى", "الدائرة الثانية"],
    },
  ],
  الطائف: [
    { court: "محكمة التنفيذ بالطائف", circuits: ["الدائرة الأولى"] },
  ],
};
