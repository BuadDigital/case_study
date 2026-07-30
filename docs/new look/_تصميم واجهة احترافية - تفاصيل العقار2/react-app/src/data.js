export const ORDERS = [
  { po: 'PO-0006', deed: 'لا صكوك', type: 'تنفيذ', props: 6, done: 0, pct: 0, status: 'تنفيذ', received: '29/06/2026', due: '02/07/2026', specialist: '' },
  { po: 'PO-002', deed: 'لا صكوك', type: 'تركات', props: 2, done: 0, pct: 0, status: 'تنفيذ', received: '29/06/2026', due: '02/07/2026', specialist: '' },
  { po: 'PO-001', deed: 'لا صكوك', type: 'تنفيذ', props: 3, done: 0, pct: 0, status: 'تنفيذ', received: '29/06/2026', due: '02/07/2026', specialist: '' },
  { po: 'PO-004', deed: 'صك واحد', type: 'تنفيذ', props: 5, done: 1, pct: 20, status: 'تنفيذ', received: '28/06/2026', due: '01/07/2026', specialist: 'أيمن مجرشي' },
  { po: 'PO-2026-0005', deed: 'لا صكوك', type: 'تنفيذ', props: 5, done: 0, pct: 0, status: 'تنفيذ', received: '28/06/2026', due: '01/07/2026', specialist: 'تركي' },
  { po: 'PO-2026-7', deed: '٣ صكوك', type: 'تنفيذ', props: 7, done: 2, pct: 29, status: 'تنفيذ', received: '28/06/2026', due: '01/07/2026', specialist: '' },
  { po: 'PO-2026-0011', deed: 'صك واحد', type: 'تنفيذ', props: 10, done: 1, pct: 10, status: 'تنفيذ', received: '24/06/2026', due: '29/06/2026', specialist: 'عمر' },
  { po: 'PO-2026-0010', deed: '٦ صكوك', type: 'تنفيذ', props: 10, done: 6, pct: 60, status: 'تنفيذ', received: '23/06/2026', due: '28/06/2026', specialist: 'عثمان' },
];

// map Arabic dd/mm/yyyy → timestamp for sorting
export const toTs = (s) => {
  const [d, m, y] = s.split('/').map(Number);
  return new Date(y, m - 1, d).getTime();
};

export const STATUS_COLORS = {
  'تنفيذ': { base: '#a4906f', fg: '#8c7857' },
  'مكتمل': { base: '#3f8f5f', fg: '#2f7a4d' },
  'معلق': { base: '#8a8d96', fg: '#696c75' },
  'مسودة': { base: '#12284C', fg: '#12284C' },
};

export const progFill = (pct) => {
  if (pct >= 60) return 'linear-gradient(90deg, #12284C, #22406e)';
  if (pct > 0) return 'linear-gradient(90deg, #8c7857, #a4906f)';
  return 'transparent';
};
