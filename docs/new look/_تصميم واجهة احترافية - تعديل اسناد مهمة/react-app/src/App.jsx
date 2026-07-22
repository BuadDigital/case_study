import React, { useMemo, useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import KpiBand from './KpiBand.jsx';
import OrdersTable from './OrdersTable.jsx';
import * as I from './icons.jsx';
import { ORDERS, toTs } from './data.js';

const WITH_TS = ORDERS.map((o) => ({ ...o, recTs: toTs(o.received), dueTs: toTs(o.due) }));

const Select = ({ value, onChange, children }) => (
  <div className="relative flex items-center">
    <select
      value={value}
      onChange={onChange}
      className="appearance-none px-[14px] py-[9px] pe-[34px] border border-line2 rounded-lg bg-white text-[13px] cursor-pointer outline-none"
    >
      {children}
    </select>
    <span className="absolute inset-inline-end-[11px] text-ink3 pointer-events-none grid place-items-center" style={{ insetInlineEnd: 11 }}>
      <I.ChevronDown size={15} sw={2} />
    </span>
  </div>
);

export default function App() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [sortKey, setSortKey] = useState('due');
  const [sortDir, setSortDir] = useState('asc');

  const onSort = (k) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  };

  const rows = useMemo(() => {
    const q = search.trim();
    let list = WITH_TS.filter((o) => {
      const okQ = !q || (o.po + ' ' + o.deed + ' ' + o.specialist + ' ' + o.type).includes(q);
      const okS = status === 'all' || o.status === status;
      const okT = type === 'all' || o.type === type;
      return okQ && okS && okT;
    });
    if (sortKey) {
      const f = { props: 'props', done: 'done', pct: 'pct', received: 'recTs', due: 'dueTs' }[sortKey];
      const dir = sortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => (a[f] - b[f]) * dir);
    }
    return list;
  }, [search, status, type, sortKey, sortDir]);

  return (
    <div className="h-screen w-full grid overflow-hidden" style={{ gridTemplateColumns: '260px 1fr' }}>
      <Sidebar />

      <div className="flex flex-col h-screen overflow-hidden">
        <Header search={search} onSearch={setSearch} />

        <div className="flex-1 overflow-y-auto px-[30px] pt-[26px] pb-11">
          <KpiBand />

          {/* toolbar */}
          <div className="flex items-center justify-between gap-4 mb-[14px] flex-wrap">
            <div className="flex items-center gap-[11px]">
              <h2 className="text-[17px] font-extrabold text-ink m-0">سجل أوامر العمل</h2>
              <span className="inline-flex items-center gap-1 px-[10px] py-[3px] rounded-md bg-goldSoft text-goldD text-[12px] font-bold">
                {rows.length}
                <span>نتيجة</span>
              </span>
            </div>

            <div className="flex items-center gap-[10px] flex-wrap">
              <div className="relative flex items-center">
                <span className="absolute inset-inline-start-3 text-ink3 pointer-events-none" style={{ insetInlineStart: 12 }}>
                  <I.Search size={15} sw={1.8} />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="PO أو رقم الصك أو نوع الإسناد..."
                  className="w-[248px] py-[9px] pe-[36px] ps-[14px] border border-line2 rounded-lg bg-white text-[13px] outline-none transition focus:border-gold focus:shadow-[0_0_0_3px_rgba(164,144,111,.22)]"
                />
              </div>

              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">جميع الحالات</option>
                <option value="تنفيذ">تنفيذ</option>
                <option value="مكتمل">مكتمل</option>
                <option value="معلق">معلق</option>
                <option value="مسودة">مسودة</option>
              </Select>

              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="all">جميع أنواع الإسناد</option>
                <option value="تنفيذ">تنفيذ</option>
                <option value="تركات">تركات</option>
              </Select>

              <button className="flex items-center gap-[7px] px-4 py-[10px] rounded-lg bg-ink text-white text-[13px] font-bold cursor-pointer shadow-[0_6px_16px_-8px_rgba(18,40,76,.6)] transition hover:bg-navy3 hover:-translate-y-px">
                <I.Plus size={16} sw={2.2} />
                <span>أمر عمل جديد</span>
              </button>
            </div>
          </div>

          <OrdersTable rows={rows} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />

          {/* pagination */}
          <div className="flex items-center justify-between gap-4 pt-4 px-1 flex-wrap">
            <div className="text-[13px] text-ink3">
              عرض <b className="text-ink font-bold">{rows.length ? '1–' + rows.length : '0'}</b> من <b className="text-ink font-bold">{rows.length}</b> نتيجة
            </div>
            <div className="flex items-center gap-[6px]">
              <button className="w-[34px] h-[34px] grid place-items-center border border-line2 rounded-md bg-white text-ink2 hover:bg-surface2">
                <I.ChevronRight size={16} sw={2} />
              </button>
              <button className="min-w-[34px] h-[34px] px-[10px] grid place-items-center rounded-md bg-ink text-white text-[13px] font-bold">1</button>
              <button className="w-[34px] h-[34px] grid place-items-center border border-line2 rounded-md bg-white text-ink2 hover:bg-surface2">
                <I.ChevronLeft size={16} sw={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
