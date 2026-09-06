"use client";

/**
 * Brand-identity top row: logo, stamp and signature cards. Each card reads
 * the workflow bag and calls its upload / delete / apply actions.
 */

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Label,
  cn,
  opsDropzone,
} from "@platform/ui-kit";
import { signatureHeightFromInput } from "./brand-identity-state";
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

export function BrandLogoCard({ workflow }: { workflow: BrandIdentityWorkflow }) {
  const { canEdit, dirty, saving, view, logoMeta, uploadAsset, deleteAsset, applyAsset } =
    workflow;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <h2 className="m-0 text-sm font-bold">الشعار</h2>
      </CardHeader>
      <CardBody className="flex flex-1 flex-col">
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <div>
            <div className={cn(opsDropzone, "h-[110px]")}>
              <img src={view.logoColor} alt="الشعار الملون" style={{ height: 40 }} />
            </div>
            <div className="mt-1.5 text-[11.5px] text-text-2">
              الشعار الملون — للخلفيات الفاتحة
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <Button
                variant="default"
                size="sm"
                disabled={!canEdit}
                onClick={() => uploadAsset("logoColor")}
              >
                استبدال
              </Button>
              <Button
                variant="dangerOutline"
                size="sm"
                disabled={!canEdit}
                onClick={() => deleteAsset("logoColor")}
              >
                حذف
              </Button>
            </div>
          </div>
          <div>
            <div
              className="grid h-[110px] place-items-center rounded-lg border border-dashed border-border-md"
              style={{ background: "var(--ink)" }}
            >
              <img src={view.logoWhite} alt="الشعار الأبيض" style={{ height: 40 }} />
            </div>
            <div className="mt-1.5 text-[11.5px] text-text-2">
              الشعار الأبيض — للخلفيات الداكنة
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <Button
                variant="default"
                size="sm"
                disabled={!canEdit}
                onClick={() => uploadAsset("logoWhite")}
              >
                استبدال
              </Button>
              <Button
                variant="dangerOutline"
                size="sm"
                disabled={!canEdit}
                onClick={() => deleteAsset("logoWhite")}
              >
                حذف
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-auto text-xs leading-relaxed text-text-2">
          المقاس الملزم: متجه SVG — ارتفاع <bdi className="font-[inherit]">48px</bdi> في
          الترويسة. لكل نسخة رفع مستقل.
        </div>
      </CardBody>
      <div className={BRAND_CARD_FOOT_CLS}>
        <span>{logoMeta}</span>
        <Button
          variant="primary"
          size="sm"
          disabled={!canEdit || !dirty.logo || saving}
          onClick={() => applyAsset("logo")}
        >
          اعتماد وتطبيق
        </Button>
      </div>
    </Card>
  );
}

export function BrandStampCard({ workflow }: { workflow: BrandIdentityWorkflow }) {
  const { canEdit, dirty, saving, view, uploadAsset, applyAsset, patchAsset } = workflow;
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
          />
        </div>
        <div className="grid min-w-[14rem] flex-1 grid-cols-2 gap-2.5">
          <div className="flex flex-col">
            <Label size="field">عرض الختم في A4 (cm)</Label>
            <Input
              className={BRAND_FIELD_CLS}
              type="number"
              dir="ltr"
              disabled={!canEdit}
              value={String(view.stampW)}
              onChange={(e) =>
                patchAsset("stamp", { stampWidthCm: Number(e.target.value) })
              }
            />
          </div>
          <div className="flex flex-col">
            <Label size="field">ارتفاع الختم في A4 (cm)</Label>
            <Input
              className={BRAND_FIELD_CLS}
              type="number"
              dir="ltr"
              disabled={!canEdit}
              value={String(view.stampH)}
              onChange={(e) =>
                patchAsset("stamp", { stampHeightCm: Number(e.target.value) })
              }
            />
          </div>
          <p className="col-span-2 m-0 text-[11.5px] leading-relaxed text-text-3">
            المقاس يسري على الصفحات المطبوعة فقط — رفع الختم نفسه من هنا.
          </p>
          <div className="col-span-2">
            <Button
              variant="default"
              size="sm"
              disabled={!canEdit}
              onClick={() => uploadAsset("stamp")}
            >
              رفع ختم جديد
            </Button>
          </div>
        </div>
      </CardBody>
      <div className={BRAND_CARD_FOOT_CLS}>
        <span>يُطبع في قسم الاعتماد (27) من كل تقرير</span>
        <Button
          variant="primary"
          size="sm"
          disabled={!canEdit || !dirty.stamp || saving}
          onClick={() => applyAsset("stamp")}
        >
          اعتماد وتطبيق
        </Button>
      </div>
    </Card>
  );
}

export function BrandSignatureCard({ workflow }: { workflow: BrandIdentityWorkflow }) {
  const { canEdit, dirty, saving, view, uploadAsset, applyAsset, patchAsset } = workflow;
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
            <Label size="field">ارتفاع التوقيع في A4 (cm)</Label>
            <Input
              className={BRAND_FIELD_CLS}
              type="number"
              dir="ltr"
              min={0.5}
              max={8}
              step={0.1}
              disabled={!canEdit}
              value={String(view.sigH)}
              onChange={(e) => {
                const n = signatureHeightFromInput(e.target.value);
                if (n == null) return;
                patchAsset("sig", { signatureHeightCm: n });
              }}
            />
          </div>
          <p className="m-0 text-[11.5px] leading-relaxed text-text-3">
            توقيع الاعتماد فقط — التحكم بالارتفاع (مثل 1.5) والعرض يتناسب مع
            الصورة. تواقيع المشاركين في التقرير بارتفاع ثابت 1.5 سم دون ضبط.
          </p>
          <div>
            <Button
              variant="default"
              size="sm"
              disabled={!canEdit}
              onClick={() => uploadAsset("signature")}
            >
              رفع توقيع جديد
            </Button>
          </div>
        </div>
      </CardBody>
      <div className={BRAND_CARD_FOOT_CLS}>
        <span>يُطبع في إعتماد التقرير (27) — تواقيع المشاركين (26) بارتفاع ثابت 1.5 سم</span>
        <Button
          variant="primary"
          size="sm"
          disabled={!canEdit || !dirty.sig || saving}
          onClick={() => applyAsset("sig")}
        >
          اعتماد وتطبيق
        </Button>
      </div>
    </Card>
  );
}
