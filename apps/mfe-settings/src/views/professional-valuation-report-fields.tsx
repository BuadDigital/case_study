"use client";

/**
 * Inline editors of `ProfessionalValuationReportView` — bullet list, paragraph,
 * finishing-spec cell, and the participants table. Presentation only.
 */

import type { OrganizationValuerRosterEntry } from "@platform/api-client";
import { K } from "./professional-valuation-report-tables";
import {
  FINISH_LABEL_RE,
  jobLabel,
  linesOf,
  memLabel,
  slashDate,
} from "./professional-valuation-report-state";

export function BulletEdit({
  text,
  canEdit,
  onChange,
}: {
  text: string;
  canEdit: boolean;
  onChange: (next: string) => void;
}) {
  const shown = linesOf(text).filter((x) => x.trim() || canEdit);
  const items = shown.length ? shown : [""];
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}>
          {canEdit ? (
            <textarea
              className="li-edit"
              rows={Math.max(1, Math.ceil(item.length / 90))}
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next.join("\n"));
              }}
            />
          ) : (
            item
          )}
        </li>
      ))}
    </ul>
  );
}

export function ParaEdit({
  text,
  canEdit,
  onChange,
}: {
  text: string;
  canEdit: boolean;
  onChange: (next: string) => void;
}) {
  if (!canEdit) return <p>{text}</p>;
  return (
    <textarea
      className="edit-p"
      rows={Math.max(2, Math.ceil(text.length / 88))}
      value={text}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function FinishCell({
  text,
  canEdit,
  onChange,
}: {
  text: string;
  canEdit: boolean;
  onChange: (next: string) => void;
}) {
  if (canEdit) {
    return (
      <td className="v finish">
        <textarea
          className="edit-p"
          rows={8}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      </td>
    );
  }
  return (
    <td className="v finish">
      {linesOf(text).map((line, i) => {
        const m = FINISH_LABEL_RE.exec(line);
        return (
          <span key={i}>
            {i > 0 ? <br /> : null}
            {m ? (
              <>
                <b>{m[1]}</b>
                {m[2]}
              </>
            ) : (
              line
            )}
          </span>
        );
      })}
    </td>
  );
}

export function ParticipantsTable({
  rows,
  branch,
}: {
  rows: OrganizationValuerRosterEntry[];
  branch: string;
}) {
  if (!rows.length) {
    return <p className="sysnote">لا مشاركين نشطين في السجل بعد.</p>;
  }
  return (
    <table className="ctr">
      <tbody>
        <tr>
          <K>الاسم</K>
          {rows.map((p) => (
            <td className="v" key={p.id}>
              {p.nameAr}
            </td>
          ))}
        </tr>
        <tr>
          <K>المسمى الوظيفي</K>
          {rows.map((p) => (
            <td className="v" key={p.id}>
              {jobLabel(p.role)}
            </td>
          ))}
        </tr>
        <tr>
          <K>فئة العضوية</K>
          {rows.map((p) => (
            <td className="v" key={p.id}>
              {memLabel(p.membershipCategory)}
            </td>
          ))}
        </tr>
        <tr>
          <K>رقم العضوية</K>
          {rows.map((p) => (
            <td className="v num" key={p.id}>
              {p.membershipNumber || "—"}
            </td>
          ))}
        </tr>
        <tr>
          <K>تاريخ انتهاء العضوية</K>
          {rows.map((p) => (
            <td className="v num" key={p.id}>
              {slashDate(p.membershipExpiresAt)}
            </td>
          ))}
        </tr>
        <tr>
          <K>فرع التقييم</K>
          {rows.map((p) => (
            <td className="v" key={p.id}>
              {branch}
            </td>
          ))}
        </tr>
        <tr>
          <K>التوقيع</K>
          {rows.map((p) => (
            <td className="v" style={{ height: 52 }} key={p.id}>
              {p.signatureUrl ? (
                <img src={p.signatureUrl} alt="" style={{ height: 40, objectFit: "contain" }} />
              ) : (
                <span className="auto">—</span>
              )}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

