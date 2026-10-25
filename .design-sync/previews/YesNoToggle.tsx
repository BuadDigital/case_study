import { useState } from "react";
import { YesNoToggle } from "@platform/ui-kit";

export function Default() {
  const [yes, setYes] = useState<boolean | null>(true);
  const [no, setNo] = useState<boolean | null>(false);
  const [unset, setUnset] = useState<boolean | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
      <YesNoToggle name="yes" value={yes} onChange={setYes} />
      <YesNoToggle name="no" value={no} onChange={setNo} />
      <YesNoToggle name="unset" value={unset} onChange={setUnset} />
    </div>
  );
}

/** Phone card: full width, 44px-tall halves. */
export function Block() {
  const [value, setValue] = useState<boolean | null>(true);
  return (
    <div style={{ maxWidth: 320 }}>
      <YesNoToggle name="block" value={value} onChange={setValue} block />
    </div>
  );
}
