"use client";

/**
 * Register-envelope modal — composition only. `useRegisterKeyEnvelopeWorkflow`
 * owns the form reducer, lookups and the register call; the section
 * components in `RegisterKeyEnvelopeSections` / `RegisterKeyEnvelopeAttachments`
 * render one slice each. Pure validation and the request body live in
 * `register-key-envelope-state`.
 */
import { Button } from "@platform/ui-kit";
import {
  AttachmentFileField,
  EnvelopePhotoField,
} from "./RegisterKeyEnvelopeAttachments";
import {
  CourtCircuitFields,
  FeeNotice,
  KeysCountField,
  MissingPhonesField,
  NotesField,
  RequestNumberField,
  SourceSelector,
  ThirdPartyFields,
} from "./RegisterKeyEnvelopeSections";
import { useRegisterKeyEnvelopeWorkflow } from "./useRegisterKeyEnvelopeWorkflow";

export function RegisterKeyEnvelopeModal({
  open,
  busy,
  onClose,
  onRegistered,
  initialRequestNumber = "",
  operationsTaskId,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onRegistered: (envelopeId: string) => void;
  /** Prefill request number when opening from a court-visit task. */
  initialRequestNumber?: string;
  /** Link envelope to the court_visit operations task (from ?task=). */
  operationsTaskId?: string;
}) {
  if (!open) return null;
  return (
    <RegisterKeyEnvelopeForm
      key={initialRequestNumber}
      busy={busy}
      onClose={onClose}
      onRegistered={onRegistered}
      initialRequestNumber={initialRequestNumber}
      operationsTaskId={operationsTaskId}
    />
  );
}

function RegisterKeyEnvelopeForm({
  busy,
  onClose,
  onRegistered,
  initialRequestNumber,
  operationsTaskId,
}: {
  busy: boolean;
  onClose: () => void;
  onRegistered: (envelopeId: string) => void;
  initialRequestNumber: string;
  operationsTaskId?: string;
}) {
  const {
    form,
    filteredSuggestions,
    listOpen,
    dragOver,
    setDragOver,
    uploading,
    saving,
    locked,
    photoReady,
    photoRef,
    receiptRef,
    letterRef,
    setText,
    setSource,
    setKeysCount,
    changeRequestNumber,
    openSuggestions,
    scheduleCloseSuggestions,
    pickSuggestion,
    handleUpload,
    removePhoto,
    handleSave,
  } = useRegisterKeyEnvelopeWorkflow({
    busy,
    initialRequestNumber,
    operationsTaskId,
    onRegistered,
    onClose,
  });
  const { source } = form;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center overflow-y-auto bg-[rgba(16,43,78,0.42)] px-4 py-[6vh] backdrop-blur-[2px] max-lg:items-stretch max-lg:px-0 max-lg:py-0"
      role="presentation"
      onClick={onClose}
    >
      <style>{`@keyframes keyModalIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}`}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kf-register-title"
        className="flex w-full max-w-[640px] flex-col overflow-hidden rounded-[16px] border border-border bg-surface shadow-[0_24px_60px_-18px_rgba(16,43,78,0.5)] [animation:keyModalIn_0.22s_ease_both] max-lg:min-h-dvh max-lg:max-w-none max-lg:rounded-none max-lg:border-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* .modal-head */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4 sm:px-[22px]">
          <h2
            id="kf-register-title"
            className="m-0 text-[16px] font-extrabold text-heading"
          >
            تسجيل ظرف مفاتيح
          </h2>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-[9px] border-none bg-surface-2 text-[15px] leading-none text-text-2 transition-[background,color] duration-150 hover:bg-row-hover hover:text-heading"
            onClick={onClose}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        {/* .modal-body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-[22px]">
          {form.formError ? (
            <div className="mb-4 rounded-[10px] border border-[color-mix(in_srgb,#d9694f_30%,transparent)] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] px-[13px] py-2.5 text-[12.5px] font-semibold text-[#a32d2d]">
              {form.formError}
            </div>
          ) : null}

          {/* .form-grid */}
          <div className="grid grid-cols-1 gap-3.5 min-[561px]:grid-cols-2">
            <RequestNumberField
              value={form.requestNumber}
              listOpen={listOpen}
              suggestions={filteredSuggestions}
              onChange={changeRequestNumber}
              onFocus={openSuggestions}
              onBlur={scheduleCloseSuggestions}
              onPick={pickSuggestion}
            />

            <SourceSelector source={source} onSelect={setSource} />

            {source === "third_party" ? (
              <ThirdPartyFields form={form} onText={setText} />
            ) : null}

            {source === "missing" ? (
              <MissingPhonesField
                value={form.missingPhones}
                onChange={(v) => setText("missingPhones", v)}
              />
            ) : null}

            <CourtCircuitFields
              court={form.court}
              circuit={form.circuit}
              onText={setText}
            />

            {source !== "missing" ? (
              <KeysCountField
                value={form.keysCountActual}
                onChange={setKeysCount}
              />
            ) : null}

            {source !== "missing" ? (
              <EnvelopePhotoField
                source={source}
                photo={form.photo}
                uploading={uploading}
                dragOver={dragOver}
                inputRef={photoRef}
                onFile={(file) => void handleUpload("photo", file, "photo")}
                onDragOverChange={setDragOver}
                onRemove={removePhoto}
              />
            ) : null}

            {source === "court" ? (
              <AttachmentFileField
                id="kf-receipt"
                label="خطاب الاستلام *"
                placeholder="اختر ملف خطاب الاستلام"
                inputRef={receiptRef}
                pick={form.receipt}
                uploading={uploading}
                onFile={(file) => void handleUpload("receipt", file, "receipt")}
              />
            ) : null}

            {source === "third_party" ? (
              <AttachmentFileField
                id="kf-letter"
                label="خطاب الطرف الثالث *"
                placeholder="اختر ملف خطاب الطرف الثالث"
                inputRef={letterRef}
                pick={form.thirdPartyLetter}
                uploading={uploading}
                onFile={(file) =>
                  void handleUpload("third-party", file, "thirdPartyLetter")
                }
              />
            ) : null}

            <NotesField
              value={form.notes}
              onChange={(v) => setText("notes", v)}
            />
          </div>

          <FeeNotice source={source} photoReady={photoReady} />
        </div>

        {/* .modal-foot */}
        <div className="flex shrink-0 flex-wrap justify-end gap-2.5 border-t border-border bg-surface-2 px-[22px] py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] max-sm:px-4">
          <button
            type="button"
            disabled={locked}
            className="min-h-11 cursor-pointer rounded-[9px] border border-border-md bg-surface px-[18px] py-2.5 text-[13px] font-semibold text-text-2 transition-colors duration-150 hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-65 max-sm:flex-1"
            onClick={onClose}
          >
            إلغاء
          </button>
          <Button
            variant="primary"
            loading={saving}
            disabled={locked}
            className="min-h-11 gap-[7px] rounded-lg border-none bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,0.6)] hover:border-none hover:bg-navy-3 max-sm:flex-1"
            showActionToast={false}
            onClick={() => void handleSave()}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>تسجيل الظرف</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
