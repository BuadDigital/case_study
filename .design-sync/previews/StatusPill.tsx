import {
  StatusPill,
  finStatusStyle,
  queueLegacyStatusStyle,
} from "@platform/ui-kit";

export function FinanceTones() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <StatusPill label="مكتمل" style={finStatusStyle("ready")} />
      <StatusPill label="قيد المراجعة" style={finStatusStyle("deferred")} />
      <StatusPill label="متعذر" style={finStatusStyle("rejected")} />
      <StatusPill label="مسودة" style={finStatusStyle("draft")} />
      <StatusPill label="معتمد" style={finStatusStyle("closed")} />
    </div>
  );
}

export function QueueTones() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <StatusPill label="مكتمل" style={queueLegacyStatusStyle("b-done")} live />
      <StatusPill label="قيد التنفيذ" style={queueLegacyStatusStyle("b-prog")} />
      <StatusPill label="متعذر" style={queueLegacyStatusStyle("b-fail")} />
      <StatusPill label="جديد" style={queueLegacyStatusStyle("b-new")} />
    </div>
  );
}
