import {
  openLoadForAssignee,
  withOpenLoadLabel,
} from "./distribution-load";

/** Select options for distribution assignees — «name — subtitle» plus their open-task load. */
export function assigneeLoadOptions(
  list: { id: string; name: string; subtitle?: string }[],
  loadByAssignee: Map<string, number>,
): { value: string; label: string }[] {
  return list.map((a) => {
    const base = a.subtitle ? `${a.name} — ${a.subtitle}` : a.name;
    const count = openLoadForAssignee(loadByAssignee, a.id);
    return {
      value: a.id,
      label: withOpenLoadLabel(base, count),
    };
  });
}
