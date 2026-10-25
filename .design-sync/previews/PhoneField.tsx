import { Input, PhoneField, Select } from "@platform/ui-kit";

/** Small caption above a full-width control — a `label` around one input, a `div` around a group. */
export function Default() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 360 }}>
      <PhoneField as="label" label="المساحة (م²)">
        <Input defaultValue="1,250" />
      </PhoneField>
      <PhoneField as="label" label="الوحدة">
        <Select defaultValue="m2">
          <option value="m2">متر مربع</option>
        </Select>
      </PhoneField>
    </div>
  );
}
