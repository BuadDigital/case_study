"use client";

/**
 * Deliver envelope — internal handoff to an inspector, external handoff with
 * proof, or return to court (custody with the clerk). Field validation and the
 * request body come from `buildDeliverHandoffBody`.
 */
import { useCallback, useRef, useState } from "react";
import {
  Button,
  Input,
  Label,
  ModalBody,
  ModalCard,
  ModalFooter,
  ModalOverlay,
  Select,
  useToast,
} from "@platform/ui-kit";
import { useIdempotentAction } from "@platform/app-shared";
import { createEnvelopeHandoff } from "../lib/keys-envelope-api";
import type { KeyEnvelopeRow } from "../lib/keys-envelope-types";
import {
  HANDOFF_NOTES_BY_KIND,
  buildDeliverHandoffBody,
  type DeliverHandoffBody,
} from "./key-envelope-detail-state";
import {
  attachmentTileTitle,
  deliverSuccessMessage,
} from "./key-envelope-dialogs-state";
import {
  DialogAttachmentPicker,
  DialogErrorBanner,
  DialogHeader,
} from "./KeyEnvelopeDialogShared";

export function DeliverEnvelopeModal({
  env,
  inspectors,
  staffLoadError,
  busy,
  onClose,
  onBusy,
  onDone,
}: {
  env: KeyEnvelopeRow;
  inspectors: { id: string; name: string }[];
  staffLoadError: string | null;
  busy: boolean;
  onClose: () => void;
  onBusy: (v: boolean) => void;
  onDone: (next: KeyEnvelopeRow) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [kind, setKind] = useState("internal");
  const [toUserId, setToUserId] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyOrg, setPartyOrg] = useState("");
  const [partyRole, setPartyRole] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [letterId, setLetterId] = useState<string | null>(null);
  const [letterName, setLetterName] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingHandoffBody = useRef<DeliverHandoffBody | null>(null);

  const { execute: executeDeliver, loading: delivering } = useIdempotentAction(
    useCallback(
      async (idempotencyKey: string) => {
        const body = pendingHandoffBody.current;
        if (!body) throw new Error("لا توجد بيانات تسليم");
        return createEnvelopeHandoff(env.id, body, idempotencyKey);
      },
      [env.id],
    ),
  );

  const buttonBusy = busy || delivering;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalCard
        onClick={(e) => e.stopPropagation()}
        className="max-w-[560px] p-0 max-lg:max-h-[min(92dvh,100%)]"
      >
        <DialogHeader
          title={<>تسليم الظرف — {env.requestNumber}</>}
          onClose={onClose}
        />
        <ModalBody className="max-h-[min(70vh,560px)] space-y-3.5 overflow-y-auto px-5 py-5 max-lg:max-h-none">
          <DialogErrorBanner error={err} />
          <div>
            <Label htmlFor="kh-type">تسليم إلى</Label>
            <Select
              id="kh-type"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setErr("");
              }}
            >
              <option value="internal">تسليم داخلي (مستخدم في النظام)</option>
              <option value="external">تسليم لجهة خارجية</option>
              <option value="return_court">إرجاع للمحكمة</option>
            </Select>
          </div>

          {kind === "internal" ? (
            <div>
              <Label htmlFor="kh-user">المعاين الميداني *</Label>
              <DialogErrorBanner error={staffLoadError} className="mt-1" />
              <Select
                id="kh-user"
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                disabled={Boolean(staffLoadError) || inspectors.length === 0}
              >
                <option value="">
                  {inspectors.length === 0 && !staffLoadError
                    ? "— لا يوجد معاينون ميدانيون نشطون —"
                    : "— اختر المعاين —"}
                </option>
                {inspectors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {kind === "external" ? (
            <div>
              <Label>بيانات الطرف الخارجي *</Label>
              <div className="mt-1 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Input
                  placeholder="الاسم * — مثال: محمد أحمد حسن"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                />
                <Input
                  placeholder="الجهة — مثال: شركة أبعاد للتقييم"
                  value={partyOrg}
                  onChange={(e) => setPartyOrg(e.target.value)}
                />
                <Input
                  placeholder="الصفة — مثال: وكيل بيع"
                  value={partyRole}
                  onChange={(e) => setPartyRole(e.target.value)}
                />
                <Input
                  dir="ltr"
                  placeholder="* 05xxxxxxxx"
                  value={partyPhone}
                  onChange={(e) => setPartyPhone(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {kind === "return_court" ? (
            <div>
              <Label>جهة المحكمة (من بيانات تسجيل الظرف)</Label>
              <div className="mt-1 flex min-h-11 items-center gap-2.5 rounded-[10px] border-[1.5px] border-border-md bg-surface-2 px-3.5 py-2.5">
                <span className="text-[13px] font-bold text-heading">
                  {env.court || "—"}
                </span>
                <span className="text-[11.5px] text-text-3">
                  {env.circuit || ""}
                </span>
              </div>
            </div>
          ) : null}

          {kind === "external" ? (
            <div>
              <Label>إثبات تسليم المفتاح *</Label>
              <DialogAttachmentPicker
                inputRef={fileRef}
                kind="handoff-letter"
                scopeKey={env.id}
                capture="environment"
                tone="blue"
                active={Boolean(letterId)}
                title={attachmentTileTitle(letterName, undefined, {
                  replace: "",
                  upload: "تصوير بالهاتف أو رفع مستند",
                })}
                hint="محضر تسليم، إيصال، أو صورة أثناء التسليم"
                onUploaded={(id, fileName) => {
                  setLetterId(id);
                  setLetterName(fileName);
                }}
              />
            </div>
          ) : null}

          <div className="rounded-[10px] border border-border bg-surface-2/50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-text-2">
            {HANDOFF_NOTES_BY_KIND[kind] ?? ""}
          </div>
        </ModalBody>
        <ModalFooter className="justify-start gap-2 border-t border-border px-5 py-3.5">
          <Button
            variant="outline"
            disabled={buttonBusy}
            showActionToast={false}
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            loading={buttonBusy}
            showActionToast={false}
            onClick={async () => {
              const built = buildDeliverHandoffBody(
                env,
                {
                  kind,
                  toUserId,
                  partyName,
                  partyOrg,
                  partyRole,
                  partyPhone,
                  letterId,
                },
                inspectors,
              );
              if (!built.ok) {
                setErr(built.error);
                return;
              }

              pendingHandoffBody.current = built.body;
              onBusy(true);
              try {
                const outcome = await executeDeliver();
                if (outcome.status === "skipped") return;
                const result = outcome.value;
                if (!result.ok) {
                  showToast(result.error, "error");
                  return;
                }
                showToast(
                  deliverSuccessMessage(kind, env.requestNumber),
                  "success",
                );
                await onDone(result.data);
              } finally {
                onBusy(false);
              }
            }}
          >
            تسليم
          </Button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
