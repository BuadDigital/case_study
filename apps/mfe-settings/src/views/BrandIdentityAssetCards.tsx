"use client";

/**
 * Brand-identity top row: logo, stamp and signature cards, and the shared card footer
 * (meta · autosave status). Each card reads the workflow bag and calls its actions.
 */

import type { ReactNode } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  Spinner,
  cn,
  opsDropzone,
} from "@platform/ui-kit";
import { saveStatusLabel, type BrandKey } from "./brand-identity-state";
import type { BrandIdentityWorkflow } from "./useBrandIdentityWorkflow";

export const BRAND_FIELD_CLS = "h-[30px] text-xs";
export const BRAND_CARD_FOOT_CLS =
  "mt-auto flex flex-wrap items-center justify-between gap-2.5 border-t border-border px-4 py-3 text-xs text-text-2";
const PREVIEW_BOX_CLS = cn(opsDropzone, "h-[110px] w-[150px] shrink-0 p-2");

const PREVIEW_IMG_STYLE = {
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
  pointerEvents: "none",
  userSelect: "none",
} as const;

const STATUS_TONE_CLS = {
  muted: "text-text-3",
  progress: "text-text-2",
  ok: "text-[#2f7a4d]",
  danger: "text-danger-text",
} as const;

/** Footer shared by every card: what is on file, and the card's autosave status. */
export function BrandCardFooter({
  workflow,
  cardKey,
  meta,
}: {
  workflow: BrandIdentityWorkflow;
  cardKey: BrandKey;
  meta: ReactNode;
}) {
  const { status, retrySave } = workflow;
  const cardStatus = status[cardKey];
  const label = saveStatusLabel(cardStatus);
  return (
    <div className={BRAND_CARD_FOOT_CLS}>
      <span className="min-w-0">{meta}</span>
      {label.text ? (
        <span
          role="status"
          className={cn("flex items-center gap-1.5 text-[11.5px] font-semibold", STATUS_TONE_CLS[label.tone])}
        >
          {cardStatus.state === "saving" ? <Spinner /> : null}
          {label.text}
          {cardStatus.state === "error" ? (
            <Button variant="ghost" size="sm" onClick={() => retrySave(cardKey)}>
              إعادة المحاولة
            </Button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function ResetDefaultButton({
  workflow,
  cardKey,
}: {
  workflow: BrandIdentityWorkflow;
  cardKey: BrandKey;
}) {
  const { canEdit, status, isDefault, resetAsset } = workflow;
  return (
    <Button
      variant="dangerOutline"
      size="sm"
      disabled={!canEdit || status[cardKey].state === "saving" || isDefault(cardKey)}
      onClick={() => resetAsset(cardKey)}
    >
      استعادة الافتراضي
    </Button>
  );
}

export function BrandLogoCard({ workflow }: { workflow: BrandIdentityWorkflow }) {
  const { canEdit, view, logoMeta, uploadAsset } = workflow;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <h2 className="m-0 text-sm font-bold">الشعار</h2>
      </CardHeader>
      <CardBody className="flex flex-1 flex-col">
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <div>
            <div className={cn(opsDropzone, "h-[110px]")}>
              <img
                src={view.logoColor}
                alt="الشعار الملون"
                style={{ maxHeight: 64, maxWidth: "90%", objectFit: "contain" }}
              />
            </div>
            <div className="mt-1.5 text-[11.5px] text-text-2">
              الملون — للخلفيات الفاتحة (صفحة الدخول على الجوال)
            </div>
            <Button
              className="mt-1.5"
              variant="default"
              size="sm"
              disabled={!canEdit}
              onClick={() => uploadAsset("logoColor")}
            >
              استبدال
            </Button>
          </div>
          <div>
            <div
              className="grid h-[110px] place-items-center rounded-lg border border-dashed border-border-md"
              style={{ background: "var(--ink)" }}
            >
              <img
                src={view.logoWhite}
                alt="الشعار الأبيض"
                style={{ maxHeight: 64, maxWidth: "90%", objectFit: "contain" }}
              />
            </div>
            <div className="mt-1.5 text-[11.5px] text-text-2">
              الأبيض — القائمة الجانبية وصفحة الدخول وترويسة تقرير دراسة الحالة
            </div>
            <Button
              className="mt-1.5"
              variant="default"
              size="sm"
              disabled={!canEdit}
              onClick={() => uploadAsset("logoWhite")}
            >
              استبدال
            </Button>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2">
          <p className="m-0 text-xs leading-relaxed text-text-2">
            PNG أو SVG بخلفية شفافة، حتى 512KB لكل نسخة.
          </p>
          <ResetDefaultButton workflow={workflow} cardKey="logo" />
        </div>
      </CardBody>
      <BrandCardFooter workflow={workflow} cardKey="logo" meta={logoMeta} />
    </Card>
  );
}

export function BrandStampCard({ workflow }: { workflow: BrandIdentityWorkflow }) {
  const {
    canEdit,
    view,
    stampMeta,
    stampLocked,
    setStampLocked,
    stampRatio,
    setStampSize,
    uploadAsset,
    onStampImageLoaded,
  } = workflow;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <h2 className="m-0 text-sm font-bold">مقاس الختم على صفحة A4</h2>
      </CardHeader>
      <CardBody className="flex flex-1 flex-wrap items-start gap-4">
        <div className={PREVIEW_BOX_CLS}>
          <img
            src={view.stamp}
            alt="ختم المنشأة"
            draggable={false}
            style={PREVIEW_IMG_STYLE}
            onLoad={(e) =>
              onStampImageLoaded(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
            }
          />
        </div>
        <div className="grid min-w-[14rem] flex-1 grid-cols-2 gap-2.5">
          <div className="flex flex-col">
            <Label size="field" htmlFor="brand-stamp-width">
              عرض الختم (cm)
            </Label>
            <Input
              id="brand-stamp-width"
              className={BRAND_FIELD_CLS}
              type="number"
              dir="ltr"
              min={0.5}
              max={20}
              step={0.1}
              disabled={!canEdit}
              value={String(view.stampW)}
              onChange={(e) => setStampSize("width", e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <Label size="field" htmlFor="brand-stamp-height">
              ارتفاع الختم (cm)
            </Label>
            <Input
              id="brand-stamp-height"
              className={BRAND_FIELD_CLS}
              type="number"
              dir="ltr"
              min={0.5}
              max={20}
              step={0.1}
              disabled={!canEdit}
              value={String(view.stampH)}
              onChange={(e) => setStampSize("height", e.target.value)}
            />
          </div>
          <label className="col-span-2 flex cursor-pointer items-center gap-2 text-[11.5px] text-text-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--ink)]"
              checked={stampLocked}
              disabled={!canEdit}
              onChange={(e) => setStampLocked(e.target.checked)}
            />
            قفل نسبة الصورة
            {stampRatio ? (
              <span className="text-text-3" dir="ltr">
                (1 : {stampRatio.toFixed(2)})
              </span>
            ) : null}
          </label>
          <p className="col-span-2 m-0 text-[11px] leading-relaxed text-text-3">{stampMeta}</p>
          <div className="col-span-2 flex flex-wrap gap-1.5">
            <Button
              variant="default"
              size="sm"
              disabled={!canEdit}
              onClick={() => uploadAsset("stamp")}
            >
              رفع ختم جديد
            </Button>
            <ResetDefaultButton workflow={workflow} cardKey="stamp" />
          </div>
        </div>
      </CardBody>
      <BrandCardFooter
        workflow={workflow}
        cardKey="stamp"
        meta="يُطبع في قسم الاعتماد (27) من كل تقرير"
      />
    </Card>
  );
}

export function BrandSignatureCard({ workflow }: { workflow: BrandIdentityWorkflow }) {
  const { canEdit, view, setSignatureHeight, uploadAsset } = workflow;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <h2 className="m-0 text-sm font-bold">مقاس التوقيع على صفحة A4</h2>
      </CardHeader>
      <CardBody className="flex flex-1 flex-wrap items-start gap-4">
        <div className={PREVIEW_BOX_CLS}>
          <img
            src={view.signature}
            alt="توقيع المقيم المعتمد"
            draggable={false}
            style={PREVIEW_IMG_STYLE}
          />
        </div>
        <div className="grid min-w-[14rem] flex-1 grid-cols-1 gap-2.5">
          <div className="flex max-w-[12rem] flex-col">
            <Label size="field" htmlFor="brand-signature-height">
              ارتفاع التوقيع (cm)
            </Label>
            <Input
              id="brand-signature-height"
              className={BRAND_FIELD_CLS}
              type="number"
              dir="ltr"
              min={0.5}
              max={8}
              step={0.1}
              disabled={!canEdit}
              value={String(view.sigH)}
              onChange={(e) => setSignatureHeight(e.target.value)}
            />
          </div>
          <p className="m-0 text-[11.5px] leading-relaxed text-text-3">
            توقيع الاعتماد فقط — العرض يتناسب مع الصورة. تواقيع المشاركين في التقرير بارتفاع
            ثابت 1.5 سم.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="default"
              size="sm"
              disabled={!canEdit}
              onClick={() => uploadAsset("signature")}
            >
              رفع توقيع جديد
            </Button>
            <ResetDefaultButton workflow={workflow} cardKey="sig" />
          </div>
        </div>
      </CardBody>
      <BrandCardFooter
        workflow={workflow}
        cardKey="sig"
        meta="يُطبع في إعتماد التقرير (27) — تواقيع المشاركين (26) بارتفاع ثابت 1.5 سم"
      />
    </Card>
  );
}

export { ResetDefaultButton };
