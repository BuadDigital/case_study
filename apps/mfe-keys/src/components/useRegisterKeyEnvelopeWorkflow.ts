"use client";

/**
 * All non-rendering workflow behind `RegisterKeyEnvelopeModal`: the form
 * reducer, the request-number suggestion index, the debounced linked-property
 * lookup, attachment uploads, and the idempotent register call. The modal
 * consumes the returned bag and keeps JSX plus event wiring only.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useToast } from "@platform/ui-kit";
import { useIdempotentAction } from "@platform/app-shared";
import { loadWorkOrderDtos } from "@platform/app-shared/app-data/work-orders-read";
import {
  fetchLinkedPropertiesByRequestNumber,
  registerKeyEnvelope,
  uploadEnvelopeAttachment,
  type CreateEnvelopeInput,
} from "../lib/keys-envelope-api";
import type { KeyEnvelopeLinkedProperty } from "../lib/keys-envelope-types";
import {
  LINKED_LOOKUP_DEBOUNCE_MS,
  LINKED_LOOKUP_MIN_CHARS,
  SUGGESTION_BLUR_CLOSE_MS,
  buildRegisterEnvelopeInput,
  buildRequestSuggestions,
  filterRequestSuggestions,
  initialRegisterFormState,
  registerFormReducer,
  registerSuccessMessage,
  validateRegisterForm,
  type RegisterPickField,
  type RegisterTextField,
  type RequestSuggestion,
} from "./register-key-envelope-state";

export type RegisterUploadKind = "photo" | "receipt" | "third-party";

export function useRegisterKeyEnvelopeWorkflow({
  busy,
  initialRequestNumber,
  operationsTaskId,
  onRegistered,
  onClose,
}: {
  busy: boolean;
  initialRequestNumber: string;
  operationsTaskId?: string;
  onRegistered: (envelopeId: string) => void;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [form, dispatch] = useReducer(
    registerFormReducer,
    initialRequestNumber,
    initialRegisterFormState,
  );
  const [linked, setLinked] = useState<KeyEnvelopeLinkedProperty[]>([]);
  const [suggestions, setSuggestions] = useState<RequestSuggestion[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLInputElement>(null);
  const letterRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);
  const pendingRegister = useRef<CreateEnvelopeInput | null>(null);

  const { execute: executeRegister, loading: saving } = useIdempotentAction(
    useCallback(async (idempotencyKey: string) => {
      const input = pendingRegister.current;
      if (!input) throw new Error("لا توجد بيانات ظرف للإرسال");
      return registerKeyEnvelope(input, idempotencyKey);
    }, []),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const orders = await loadWorkOrderDtos();
        if (cancelled) return;
        setSuggestions(buildRequestSuggestions(orders));
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestNumber = form.requestNumber;
  useEffect(() => {
    const trimmed = requestNumber.trim();
    if (trimmed.length < LINKED_LOOKUP_MIN_CHARS) {
      setLinked([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const result = await fetchLinkedPropertiesByRequestNumber(trimmed);
        if (cancelled) return;
        if (result.ok) {
          setLinked(result.data);
          const first = result.data[0];
          if (first) {
            dispatch({
              type: "apply-linked-defaults",
              court: first.court,
              circuit: first.circuit,
            });
          }
        } else {
          setLinked([]);
        }
      })();
    }, LINKED_LOOKUP_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [requestNumber]);

  const filteredSuggestions = useMemo(
    () => filterRequestSuggestions(suggestions, requestNumber),
    [suggestions, requestNumber],
  );

  const photoReady = Boolean(form.photo?.attachmentId);
  const photoPicked = Boolean(form.photo);
  const locked = saving || busy || uploading;

  function setText(field: RegisterTextField, value: string) {
    dispatch({ type: "set-text", field, value });
  }

  function changeRequestNumber(value: string) {
    setText("requestNumber", value);
    setListOpen(true);
  }

  function openSuggestions() {
    setListOpen(true);
  }

  /** Let a suggestion click land before the list disappears. */
  function scheduleCloseSuggestions() {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    blurTimer.current = window.setTimeout(
      () => setListOpen(false),
      SUGGESTION_BLUR_CLOSE_MS,
    );
  }

  function pickSuggestion(suggestion: RequestSuggestion) {
    dispatch({ type: "pick-suggestion", suggestion });
    setListOpen(false);
  }

  async function handleUpload(
    kind: RegisterUploadKind,
    file: File | undefined,
    field: RegisterPickField,
  ) {
    if (!file) return;
    if (kind === "photo" && !file.type.startsWith("image/")) {
      showToast("يُقبل ملف صورة فقط لصورة الظرف.", "error");
      return;
    }
    setUploading(true);
    dispatch({ type: "set-pick", field, pick: { file } });
    dispatch({ type: "set-error", error: "" });
    const upload = await uploadEnvelopeAttachment(
      kind,
      form.requestNumber.trim() || "draft",
      file,
    );
    setUploading(false);
    if (!upload.ok) {
      showToast(upload.error, "error");
      dispatch({ type: "set-pick", field, pick: null });
      return;
    }
    dispatch({
      type: "set-pick",
      field,
      pick: { file, attachmentId: upload.data.id },
    });
  }

  function removePhoto() {
    dispatch({ type: "set-pick", field: "photo", pick: null });
  }

  async function handleSave() {
    if (locked) return;
    const error = validateRegisterForm(form);
    if (error) {
      dispatch({ type: "set-error", error });
      return;
    }
    dispatch({ type: "set-error", error: "" });
    const input = buildRegisterEnvelopeInput(form, { operationsTaskId, linked });
    pendingRegister.current = input;
    const outcome = await executeRegister();
    if (outcome.status === "skipped") return;
    const result = outcome.value;
    if (!result.ok) {
      dispatch({ type: "set-error", error: result.error });
      showToast(result.error, "error");
      return;
    }
    const entitled = !!result.data.revenueEntitlementAtUtc;
    showToast(registerSuccessMessage(input.requestNumber, entitled), "success");
    onRegistered(result.data.id);
    onClose();
  }

  return {
    form,
    filteredSuggestions,
    listOpen,
    dragOver,
    setDragOver,
    uploading,
    saving,
    locked,
    photoReady,
    photoPicked,
    photoRef,
    receiptRef,
    letterRef,
    setText,
    setSource: (source: (typeof form)["source"]) =>
      dispatch({ type: "set-source", source }),
    setKeysCount: (value: string) => dispatch({ type: "set-keys-count", value }),
    changeRequestNumber,
    openSuggestions,
    scheduleCloseSuggestions,
    pickSuggestion,
    handleUpload,
    removePhoto,
    handleSave,
  };
}

export type RegisterKeyEnvelopeWorkflow = ReturnType<
  typeof useRegisterKeyEnvelopeWorkflow
>;
