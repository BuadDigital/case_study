import { Card, CardBody } from "@platform/ui-kit";

export function Text() {
  return (
    <Card style={{ maxWidth: 380 }}>
      <CardBody>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>
          رقم الصك 88120044991 — صادر بتاريخ 1445/03/12هـ، فعّال وغير موقوف.
        </p>
      </CardBody>
    </Card>
  );
}
