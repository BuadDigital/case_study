"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  MobileRecordCard,
  MobileRecordList,
  Note,
  PageGutter,
  PanelSkeleton,
  QueryErrorState,
  Table,
  TableFrame,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import { poPropertyPath } from "@platform/app-shared/domain/po-routes";
import type { PropertyWorkflowStage } from "@platform/app-shared/app-data/constants";
import { PoNumber } from "../components/ui/PoNumber";
import {
  PpDeedCell,
  PpEmpty,
  PpHead,
  PpMeta,
  PpPo,
  PpStatus,
  PpTitle,
  deedStatusStyle,
} from "../components/po-intake/PoPropertiesHtmlPrimitives";
import { poPropertyRowView } from "../components/po-intake/po-property-row-view";
import { PROPERTY_TYPE_USAGE_LABEL } from "../lib/app-data/po-intake-data";
import { isExternalPartyRole } from "../lib/app-data/po-roles";
import { deedsWithRequestNumber } from "../lib/app-data/request-number-deeds";
import { usePoRecordsQuery, usePropertyListItemsQuery } from "../query/case-study-queries";

/**
 * «صكوك رقم الطلب» — every deed carrying the same request number as the deed it was opened from,
 * across the work orders (Omar 2026-11-15: the header's «رقم الطلب» opens it, a page of its own).
 *
 * How it works: the work orders the viewer may read are searched for the request number of
 * `propertyId` (`deedsWithRequestNumber`); each row shows the deed, its work order, location, type,
 * deed status and workflow badge (`poPropertyRowView`, as a work order's deed list) and opens the deed.
 * Edge cases: the external parties are told the page is not for them; a deed with no request number
 * says so; the deed it was opened from is marked «هذا الصك».
 */
export function PoRequestDeedsPage({ poNumber, propertyId }: { poNumber: string; propertyId: string }) {
  const router = useRouter();
  const { role } = useAppAccess();
  const recordsQuery = usePoRecordsQuery();
  const { data: records, isPending } = recordsQuery;
  const { data: propertyListItems = [] } = usePropertyListItemsQuery();

  const statusByPropertyId = useMemo(() => {
    const map = new Map<string, PropertyWorkflowStage>();
    for (const item of propertyListItems) map.set(item.propertyId, item.row.status);
    return map;
  }, [propertyListItems]);

  const current = records
    ?.find((r) => r.poNumber.trim() === poNumber.trim())
    ?.properties.find((p) => p.id === propertyId);
  const requestNumber = current?.requestNumber.trim() ?? "";
  const deeds = useMemo(() => deedsWithRequestNumber(records ?? [], requestNumber), [records, requestNumber]);
  const back = () => router.push(poPropertyPath(poNumber, propertyId));

  if (isExternalPartyRole(role)) {
    return (
      <PageGutter className="py-6">
        <Note tone="warn">هذه الصفحة غير متاحة لدورك.</Note>
      </PageGutter>
    );
  }
  if (isPending && !records) return <PanelSkeleton className="m-2" />;
  if (!records && queryLoadFailed(recordsQuery)) {
    return (
      <PageGutter className="py-6">
        <QueryErrorState
          panel
          line="تعذّر تحميل أوامر العمل"
          error={recordsQuery.error}
          onRetry={() => void recordsQuery.refetch()}
          retrying={recordsQuery.isFetching}
        />
      </PageGutter>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-bg px-4 py-5 max-lg:px-3 sm:px-[30px] sm:py-[26px]">
      <PpHead>
        <div className="absolute left-3 top-3 z-10">
          <Button size="sm" variant="default" onClick={back}>
            رجوع للصك
          </Button>
        </div>
        <PpTitle>
          <span>صكوك رقم الطلب</span>
          {requestNumber ? <PpPo>{requestNumber}</PpPo> : null}
        </PpTitle>
        <PpMeta>
          {requestNumber
            ? `${deeds.length} ${deeds.length === 1 ? "صك" : "صكوك"} بنفس رقم الطلب في أوامر العمل`
            : "لا يحمل هذا الصك رقم طلب."}
        </PpMeta>
      </PpHead>

      {deeds.length === 0 ? (
        <PpEmpty title="لا توجد صكوك بهذا الرقم." />
      ) : (
        <>
          <MobileRecordList className="sm:hidden">
            {deeds.map(({ poNumber: po, property }, index) => {
              const view = poPropertyRowView(property, po, statusByPropertyId.get(property.id));
              return (
                <MobileRecordCard
                  key={property.id}
                  title={<PpDeedCell index={index + 1} deed={view.label} emphasize={property.id === propertyId} />}
                  subtitle={view.location}
                  fields={[
                    { label: "أمر العمل", value: <PoNumber value={po} /> },
                    ...(view.typeDisplay !== "—" ? [{ label: "النوع", value: view.typeDisplay }] : []),
                  ]}
                  onOpen={() => router.push(view.detailHref)}
                >
                  <PpStatus label={view.workflowStyle.label} style={view.workflowStyle} />
                </MobileRecordCard>
              );
            })}
          </MobileRecordList>
          <TableFrame className="hidden sm:block">
            <Table className="min-w-[820px]">
              <THead>
                <Tr hoverable={false}>
                  <Th>رقم الصك</Th>
                  <Th>أمر العمل</Th>
                  <Th>الموقع</Th>
                  <Th>{PROPERTY_TYPE_USAGE_LABEL}</Th>
                  <Th>حالة الصك</Th>
                  <Th>الحالة</Th>
                </Tr>
              </THead>
              <TBody>
                {deeds.map(({ poNumber: po, property }, index) => {
                  const view = poPropertyRowView(property, po, statusByPropertyId.get(property.id));
                  const open = () => router.push(view.detailHref);
                  return (
                    <Tr
                      key={property.id}
                      role="button"
                      tabIndex={0}
                      onClick={open}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          open();
                        }
                      }}
                    >
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <PpDeedCell index={index + 1} deed={view.label} emphasize={property.id === propertyId} />
                          {property.id === propertyId ? (
                            <span className="text-[11px] text-text-3">هذا الصك</span>
                          ) : null}
                        </span>
                      </Td>
                      <Td>
                        <PoNumber value={po} />
                      </Td>
                      <Td className="text-text-2">
                        <span className="truncate">{view.location}</span>
                      </Td>
                      <Td>
                        <span className="truncate">{view.typeDisplay}</span>
                      </Td>
                      <Td>
                        {view.boursePending || !view.deedSt ? (
                          <span className="text-text-2">—</span>
                        ) : (
                          <PpStatus label={view.deedSt} style={deedStatusStyle(view.deedSt)} />
                        )}
                      </Td>
                      <Td>
                        <div className="flex min-w-0 flex-col items-start gap-0.5">
                          <PpStatus label={view.workflowStyle.label} style={view.workflowStyle} />
                          {property.isRemoved && property.removalReason.trim() ? (
                            <span className="text-[11px] font-medium text-[#c0553d]">
                              {property.removalReason.trim()}
                            </span>
                          ) : null}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableFrame>
        </>
      )}
    </div>
  );
}
