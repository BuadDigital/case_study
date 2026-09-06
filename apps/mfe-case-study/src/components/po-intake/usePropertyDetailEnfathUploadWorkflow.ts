"use client";

/**
 * Workflow behind the Infath upload assistant: the upload model (from record,
 * property, party submissions, documents and ops context), the deposit draft,
 * the collapse / copied sets, and the copy + download handlers.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@platform/ui-kit";
import {
  buildInfathUploadModel,
  copyInfathText,
  downloadInfathDocument,
  type InfathOpsContext,
} from "../../lib/app-data/infath-upload-model";
import type {
  InfathUploadAttachment,
  InfathUploadModel,
} from "../../lib/app-data/infath-upload-types";
import type { PropertyDetailDocumentSection } from "../../lib/app-data/property-detail-documents";
import type { PropertyDetailPartySubmissionsMap } from "../../lib/app-data/property-detail-party-submissions";
import {
  formatPropertyDeedDisplay,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import { usePropertyOperationsTasks } from "../../query/use-property-operations-tasks";
import {
  resolveEnvelopeIdFromSources,
  usePropertyKeyGateQuery,
} from "../../query/use-property-key-gate-query";
import {
  loadInfathDeposit,
  saveInfathDeposit,
  type InfathDepositDraft,
} from "../../lib/app-data/infath-deposit-storage";
import {
  DEPOSIT_CERTIFICATE_FIELD_LABEL,
  DEPOSIT_CODE_FIELD_LABEL,
  appraisalFieldValue,
  collapsedSectionIds,
  copyToastPreview,
  courtVisitOpsFields,
  findInfathDocumentByName,
  initialCollapsedSectionIds,
  readyAttachments,
  toggledSet,
  withCopiedKey,
  type CopyKey,
} from "./property-detail-enfath-upload-state";

export type PropertyDetailEnfathUploadWorkflow = {
  model: InfathUploadModel;
  depositDraft: InfathDepositDraft;
  patchDeposit: (patch: Partial<InfathDepositDraft>) => void;
  collapsedSections: Set<string>;
  copiedKeys: Set<CopyKey>;
  toggleSection: (sectionId: string) => void;
  setAllCollapsed: (collapse: boolean) => void;
  handleCopyField: (key: CopyKey, text: string) => Promise<void>;
  handleCopyArea: (key: CopyKey, text: string) => Promise<void>;
  handleDownloadFile: (fileName: string) => void;
  handleDownloadAttachment: (item: InfathUploadAttachment) => void;
  handleDownloadAll: () => void;
};

export function usePropertyDetailEnfathUploadWorkflow({
  record,
  property,
  parties,
  documentSections,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  parties: PropertyDetailPartySubmissionsMap | null | undefined;
  documentSections: PropertyDetailDocumentSection[];
}): PropertyDetailEnfathUploadWorkflow {
  const poNumber = record.poNumber.trim();
  const deedNumber = property.deedNumber.trim();
  const deedDisplay = formatPropertyDeedDisplay(property) || deedNumber;

  const { primaryCourtVisit } = usePropertyOperationsTasks(
    { poNumber, deedNumber, deedDisplay },
    { live: true },
  );
  const { data: keyGate } = usePropertyKeyGateQuery({
    propertyId: property.id,
    poNumber,
    deedNumber,
    requestNumber: property.requestNumber.trim() || undefined,
  });

  const [depositDraft, setDepositDraft] = useState(() =>
    loadInfathDeposit(property.id),
  );

  useEffect(() => {
    setDepositDraft(loadInfathDeposit(property.id));
  }, [property.id]);

  const patchDeposit = useCallback(
    (patch: Partial<InfathDepositDraft>) => {
      setDepositDraft((prev) => {
        const next = { ...prev, ...patch };
        saveInfathDeposit(property.id, next);
        return next;
      });
    },
    [property.id],
  );

  const opsContext = useMemo((): InfathOpsContext => {
    const visit = primaryCourtVisit;
    const envelopeId = resolveEnvelopeIdFromSources(
      keyGate,
      visit?.linkedEnvelopeId,
    );
    const appraisalFields = parties?.appraisal?.fields;
    return {
      ...courtVisitOpsFields(visit),
      keysStatus: keyGate?.keysStatus ?? null,
      keyAvailable: keyGate?.keyAvailable,
      envelopeId,
      depositCode:
        appraisalFieldValue(appraisalFields, DEPOSIT_CODE_FIELD_LABEL) ??
        depositDraft.depositCode,
      depositCertificateName:
        appraisalFieldValue(appraisalFields, DEPOSIT_CERTIFICATE_FIELD_LABEL) ??
        depositDraft.depositCertificateName,
    };
  }, [primaryCourtVisit, keyGate, depositDraft, parties]);

  const model = useMemo(
    () =>
      buildInfathUploadModel({
        record,
        property,
        parties: parties ?? null,
        documentSections,
        opsContext,
      }),
    [record, property, parties, documentSections, opsContext],
  );

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(),
  );
  const [copiedKeys, setCopiedKeys] = useState<Set<CopyKey>>(() => new Set());
  const { showToast } = useToast();
  const initializedCollapseRef = useRef(false);

  useEffect(() => {
    if (initializedCollapseRef.current) return;
    initializedCollapseRef.current = true;
    setCollapsedSections(initialCollapsedSectionIds(model.sections));
  }, [model.sections]);

  const markCopied = useCallback(
    (key: CopyKey, text: string) => {
      setCopiedKeys((prev) => withCopiedKey(prev, key));
      showToast(`تم النسخ: ${copyToastPreview(text)}`);
    },
    [showToast],
  );

  const handleCopyField = useCallback(
    async (key: CopyKey, text: string) => {
      const copied = await copyInfathText(text);
      if (copied) markCopied(key, text);
      else showToast("تعذّر نسخ النص — حاول يدوياً", "error");
    },
    [markCopied, showToast],
  );

  const handleCopyArea = useCallback(
    async (key: CopyKey, text: string) => {
      const copied = await copyInfathText(text);
      if (copied) markCopied(key, text);
      else showToast("تعذّر نسخ النص — حاول يدوياً", "error");
    },
    [markCopied, showToast],
  );

  const handleDownloadFile = useCallback(
    (fileName: string) => {
      const doc = findInfathDocumentByName(
        model.attachments,
        documentSections,
        fileName,
      );
      if (doc?.dataUrl) {
        downloadInfathDocument(doc);
        showToast(`جارٍ تحميل: ${fileName}`);
      } else {
        showToast(`لا يتوفر ملف للتحميل: ${fileName}`);
      }
    },
    [documentSections, model.attachments, showToast],
  );

  const handleDownloadAttachment = useCallback(
    (item: InfathUploadAttachment) => {
      if (item.document?.dataUrl) {
        downloadInfathDocument(item.document);
        showToast(`جارٍ تحميل: ${item.name}`);
      } else {
        showToast(`غير متوفر: ${item.name}`);
      }
    },
    [showToast],
  );

  const handleDownloadAll = useCallback(() => {
    const ready = readyAttachments(model.attachments);
    if (ready.length === 0) {
      showToast("لا توجد مرفقات جاهزة للتحميل");
      return;
    }
    for (const item of ready) {
      downloadInfathDocument(item.document);
    }
    showToast(`جارٍ تحميل كل المرفقات…`);
  }, [model.attachments, showToast]);

  const setAllCollapsed = useCallback(
    (collapse: boolean) => {
      setCollapsedSections(collapsedSectionIds(model.sections, collapse));
    },
    [model.sections],
  );

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => toggledSet(prev, sectionId));
  }, []);

  return {
    model,
    depositDraft,
    patchDeposit,
    collapsedSections,
    copiedKeys,
    toggleSection,
    setAllCollapsed,
    handleCopyField,
    handleCopyArea,
    handleDownloadFile,
    handleDownloadAttachment,
    handleDownloadAll,
  };
}
