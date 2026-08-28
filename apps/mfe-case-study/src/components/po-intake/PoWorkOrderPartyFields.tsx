"use client";

import { useMemo } from "react";
import { type ClientDto } from "@platform/api-client";
import { RegSelect } from "@platform/app-shared/registration/FormFields";
import {
  defaultSubClientId,
  INFATH_SUB_CLIENT_IDS,
  isSelectableWorkOrderClient,
  showsSubClientField,
  type AssignmentType,
} from "../../lib/prototype/po-intake-data";
import { ValuationReportUserField } from "./ValuationReportUserField";

export function PoWorkOrderPartyFields({
  assignmentType,
  clientId,
  subClientId,
  clients,
  clientsLoading,
  clientError,
  subClientError,
  idPrefix,
  clientLocked = false,
  onClientChange,
  onSubClientChange,
}: {
  assignmentType: AssignmentType | "";
  clientId: string;
  subClientId: string;
  clients: ClientDto[];
  clientsLoading: boolean;
  clientError?: string;
  subClientError?: string;
  idPrefix: string;
  /** New PO: Infath is the only client and cannot be changed. */
  clientLocked?: boolean;
  onClientChange: (id: string) => void;
  onSubClientChange: (id: string) => void;
}) {
  const showSubClient = showsSubClientField(assignmentType, clientId);

  // هوية مصفوفة الخيارات كانت تتجدد مع كل رسم وتمسح memo الحقل (rerender-memo).
  const subClientOptions = useMemo(
    () =>
      INFATH_SUB_CLIENT_IDS.map((id) => ({
        value: id,
        label:
          clients.find((c) => c.id === id)?.nameAr ?? "شركة نبر العقارية",
      })),
    [clients],
  );

  return (
    <>
      <RegSelect
        id={`${idPrefix}_client`}
        label="العميل"
        required
        value={clientId}
        error={clientError}
        disabled={clientsLoading || clientLocked}
        placeholder={clientsLoading ? "جاري التحميل…" : "اختر العميل"}
        options={clients
          .filter(
            (c) =>
              isSelectableWorkOrderClient(c.id, clientId) &&
              (c.isActive || c.id === clientId),
          )
          .map((c) => ({
            value: c.id,
            label: c.isActive ? c.nameAr : `${c.nameAr} (معطّل)`,
          }))}
        onChange={onClientChange}
      />
      {showSubClient ? (
        <RegSelect
          id={`${idPrefix}_sub_client`}
          label="العميل الفرعي"
          required
          value={subClientId || defaultSubClientId()}
          error={subClientError}
          options={subClientOptions}
          onChange={onSubClientChange}
        />
      ) : null}
      <ValuationReportUserField
        id={`${idPrefix}_report_user`}
        assignmentType={assignmentType}
        clientId={clientId}
      />
    </>
  );
}
