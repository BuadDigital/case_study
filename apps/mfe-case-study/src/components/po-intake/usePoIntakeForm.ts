"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@platform/ui-kit";
import { useCommandMutation } from "@platform/app-shared";
import {
  INFATH_SEED_CLIENT_ID,
  listClients,
  type ClientDto,
} from "@platform/api-client";
import {
  defaultSubClientId,
  reportUserClientIdsForAssignment,
  showsSubClientField,
  type AssignmentType,
  type PoIntakeRecord,
} from "../../lib/app-data/po-intake-data";
import {
  buildPoRecord,
  PO_INTAKE_DRAFT_SAVE_FAILED_EVENT,
} from "../../lib/app-data/po-intake-model";
import {
  hydratePoDraft,
  poRecordExists,
} from "../../lib/app-data/po-intake-reads";
import {
  clearPoDraft,
  savePoDraft,
  savePoRecord,
} from "../../lib/app-data/po-intake-commands";
import {
  collectRequiredErrors,
  hasFieldErrors,
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";
import {
  firstPoHeaderErrorMessage,
  PO_HEADER_MODAL_FIELD_IDS,
  scheduleScrollToFirstPoHeaderError,
} from "../../lib/domain/po-intake/po-field-error-targets";
import { workOrdersApiConfig } from "../../lib/work-orders-api-config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function usePoIntakeForm(onComplete: (record: PoIntakeRecord) => void) {
  const { showToast } = useToast();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [draftReady, setDraftReady] = useState(false);

  const [poNumber, setPoNumber] = useState("");
  const [promulgationDate, setPromulgationDate] = useState("");
  const [assignmentType, setAssignmentType] = useState<AssignmentType | "">("");
  const [assignmentSpecialist, setAssignmentSpecialist] = useState("");
  const [assignmentSpecialistEmail, setAssignmentSpecialistEmail] = useState("");
  const [expectedPropertyCount, setExpectedPropertyCount] = useState("1");
  const [workOrderDescription, setWorkOrderDescription] = useState("");
  const [clientId, setClientId] = useState(INFATH_SEED_CLIENT_ID);
  const [subClientId, setSubClientId] = useState(defaultSubClientId());
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  useEffect(() => {
    void hydratePoDraft()
      .then((draft) => {
        if (draft) {
          setPoNumber(draft.poNumber);
          setPromulgationDate(draft.promulgationDate);
          setAssignmentType(draft.assignmentType || "");
          setAssignmentSpecialist(draft.assignmentSpecialist);
          setAssignmentSpecialistEmail(draft.assignmentSpecialistEmail);
          const count = draft.expectedPropertyCount;
          setExpectedPropertyCount(count && count > 0 ? String(count) : "1");
          setWorkOrderDescription(draft.workOrderDescription ?? "");
        }
        setDraftReady(true);
      })
      .catch((error) => {
        showToast(
          error instanceof Error
            ? error.message
            : "تعذّر تحميل مسودة أمر العمل",
          "error",
        );
        setDraftReady(true);
      });
  }, []);

  useEffect(() => {
    const config = workOrdersApiConfig();
    if (!config) {
      setClientsLoading(false);
      return;
    }
    void listClients(config).then((res) => {
      setClientsLoading(false);
      if (res.ok) setClients(res.data);
    });
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const error = (event as CustomEvent<{ error?: string }>).detail?.error;
      showToast(error ?? "تعذّر حفظ مسودة أمر العمل", "error");
    };
    window.addEventListener(PO_INTAKE_DRAFT_SAVE_FAILED_EVENT, handler);
    return () =>
      window.removeEventListener(PO_INTAKE_DRAFT_SAVE_FAILED_EVENT, handler);
  }, [showToast]);

  const isDirty = useMemo(
    () =>
      !!poNumber.trim() ||
      !!promulgationDate ||
      !!assignmentType ||
      !!assignmentSpecialist.trim() ||
      !!assignmentSpecialistEmail.trim() ||
      !!workOrderDescription.trim() ||
      clientId !== INFATH_SEED_CLIENT_ID ||
      subClientId !== defaultSubClientId() ||
      expectedPropertyCount !== "1",
    [
      poNumber,
      promulgationDate,
      assignmentType,
      assignmentSpecialist,
      assignmentSpecialistEmail,
      workOrderDescription,
      clientId,
      subClientId,
      expectedPropertyCount,
    ],
  );

  useEffect(() => {
    if (!draftReady) return;
    savePoDraft({
      step: 1,
      poNumber,
      promulgationDate,
      assignmentType,
      assignmentSpecialist,
      assignmentSpecialistEmail,
      expectedPropertyCount: Math.max(
        1,
        parseInt(expectedPropertyCount, 10) || 1,
      ),
      propertiesRegion: "",
      workOrderDescription,
      clientId,
    });
  }, [
    draftReady,
    poNumber,
    promulgationDate,
    assignmentType,
    assignmentSpecialist,
    assignmentSpecialistEmail,
    expectedPropertyCount,
    workOrderDescription,
    clientId,
  ]);

  function handleAssignmentType(next: AssignmentType) {
    setAssignmentType(next);
  }

  function clearErrors() {
    setFieldErrors({});
    setFormError(null);
  }

  async function validateHeader(): Promise<boolean> {
    clearErrors();
    const errors = mergeFieldErrors(
      collectRequiredErrors(
        {
          poNumber,
          promulgationDate,
          assignmentType,
          clientId,
        },
        ["poNumber", "promulgationDate", "assignmentType", "clientId"],
      ),
    );
    if (showsSubClientField(assignmentType, clientId) && !subClientId.trim()) {
      errors.subClientId = "اختر العميل الفرعي";
    }
    if (
      assignmentSpecialistEmail.trim() &&
      !EMAIL_RE.test(assignmentSpecialistEmail.trim())
    ) {
      errors.assignmentSpecialistEmail = "صيغة الإيميل غير صالحة";
    }
    const count = parseInt(expectedPropertyCount, 10);
    if (!Number.isFinite(count) || count < 1) {
      errors.expectedPropertyCount = "عدد العقارات يجب أن يكون 1 على الأقل";
    }
    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      setFormError(firstPoHeaderErrorMessage(errors));
      scheduleScrollToFirstPoHeaderError(errors, PO_HEADER_MODAL_FIELD_IDS);
      return false;
    }
    if (await poRecordExists(poNumber)) {
      const dup = { poNumber: "رقم PO مسجّل مسبقاً في النظام" };
      setFieldErrors(dup);
      setFormError(dup.poNumber);
      scheduleScrollToFirstPoHeaderError(dup, PO_HEADER_MODAL_FIELD_IDS);
      return false;
    }
    return true;
  }

  const { run: runSave, loading: saving } = useCommandMutation(
    useCallback(
      async (
        args: {
          poNumber: string;
          assignmentType: AssignmentType;
          promulgationDate: string;
          assignmentSpecialist: string;
          assignmentSpecialistEmail: string;
          expectedPropertyCount: string;
          workOrderDescription: string;
          subClientId: string;
          clients: typeof clients;
        },
        idempotencyKey: string,
      ) => {
        const clientNameAr = args.clients.find(
          (c) => c.id === INFATH_SEED_CLIENT_ID,
        )?.nameAr;
        const record = buildPoRecord({
          poNumber: args.poNumber.trim(),
          assignmentType: args.assignmentType,
          promulgationDate: args.promulgationDate,
          assignmentSpecialist: args.assignmentSpecialist.trim(),
          assignmentSpecialistEmail: args.assignmentSpecialistEmail.trim(),
          expectedPropertyCount: Math.max(
            1,
            parseInt(args.expectedPropertyCount, 10) || 1,
          ),
          reportUserClientIds: reportUserClientIdsForAssignment(
            args.assignmentType,
            INFATH_SEED_CLIENT_ID,
            args.subClientId,
          ),
          propertiesRegion: "",
          workOrderDescription: args.workOrderDescription.trim(),
          clientId: INFATH_SEED_CLIENT_ID,
          clientNameAr,
          properties: [],
        });
        return savePoRecord(record, idempotencyKey);
      },
      [],
    ),
  );

  async function save() {
    if (!(await validateHeader())) return;

    clearErrors();

    try {
      const outcome = await runSave({
        poNumber,
        assignmentType: assignmentType as AssignmentType,
        promulgationDate,
        assignmentSpecialist,
        assignmentSpecialistEmail,
        expectedPropertyCount,
        workOrderDescription,
        subClientId,
        clients,
      });
      if (outcome.status === "skipped") return;

      const result = outcome.value;
      if (!result.ok) {
        setFormError(result.error);
        if (result.errors) setFieldErrors(result.errors);
        return;
      }

      await clearPoDraft();
      onComplete(result.data);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "تعذّر حفظ أمر العمل",
        "error",
      );
    }
  }

  return {
    saving,
    formError,
    fieldErrors,
    isDirty,
    poNumber,
    setPoNumber,
    promulgationDate,
    setPromulgationDate,
    assignmentType,
    setAssignmentType: handleAssignmentType,
    assignmentSpecialist,
    setAssignmentSpecialist,
    assignmentSpecialistEmail,
    setAssignmentSpecialistEmail,
    expectedPropertyCount,
    setExpectedPropertyCount,
    workOrderDescription,
    setWorkOrderDescription,
    clientId,
    setClientId,
    subClientId,
    setSubClientId,
    clients,
    clientsLoading,
    save,
  };
}
