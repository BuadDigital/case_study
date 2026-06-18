"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RegistrationPortal } from "@platform/app-shared/registration/RegistrationPortal";
import { RegisterUserFlow } from "@platform/app-shared/registration/RegisterUserFlow";
import {
  Badge,
  Button,
  Note,
  SkeletonTableRows,
  SubpageHeader,
  SubpagePanel,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from "@platform/design-system";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import type { RegistrationSource } from "@platform/app-shared/prototype/registration-data";
import { submitRegistration, deactivateStaffUser } from "../lib/users-api";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { UsersOrganizationView } from "./users/UsersOrganizationView";
import { useStaffUsersQuery } from "../query/settings-queries";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";

type UsersMode = "list" | "portal" | "register";

function preferredSourceForRole(
  role: ReturnType<typeof usePrototype>["role"],
): RegistrationSource | null {
  if (role === "hr-admin") return "hr";
  if (role === "proc-admin") return "proc";
  if (role === "crm-admin") return "crm";
  return null;
}

function addButtonLabel(
  preferredSource: RegistrationSource | null,
): string {
  if (preferredSource === "hr") return "+ تسجيل موظف";
  if (preferredSource === "proc") return "+ تسجيل مقدم خدمة";
  if (preferredSource === "crm") return "+ تسجيل عميل";
  return "+ إضافة مستخدم";
}

function usersTitleForSource(preferredSource: RegistrationSource | null): string {
  if (preferredSource === "hr") return "موظفو الموارد البشرية";
  if (preferredSource === "proc") return "مستخدمو المالية والعقود";
  if (preferredSource === "crm") return "مستخدمو علاقات العملاء";
  return "جميع المستخدمين";
}

function usersEmptyForSource(preferredSource: RegistrationSource | null): string {
  if (preferredSource === "hr")
    return "لا يوجد موظفون في الموارد البشرية — أعد تشغيل API لتحميل البيانات المُهيّأة، أو أضف موظفاً جديداً.";
  if (preferredSource === "proc")
    return "لا يوجد مستخدمون في المالية والعقود — أضف مستخدماً جديداً.";
  if (preferredSource === "crm")
    return "لا يوجد مستخدمون في علاقات العملاء — أضف مستخدماً جديداً.";
  return "لا يوجد مستخدمون — أضف مستخدماً جديداً.";
}

export function UsersView() {
  const queryClient = useQueryClient();
  const { role } = usePrototype();
  const isCdo = role === "cdo";

  if (isCdo) {
    return <UsersOrganizationView />;
  }

  return <UsersStaffListView role={role} queryClient={queryClient} />;
}

function UsersStaffListView({
  role,
  queryClient,
}: {
  role: ReturnType<typeof usePrototype>["role"];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const viewOnly = role === "general-manager";
  const preferredSource = preferredSourceForRole(role);

  const { data: staffResult } = useStaffUsersQuery();
  const staff = useMemo(() => staffResult?.users ?? [], [staffResult?.users]);
  const loadError = staffResult?.loadError ?? null;
  const dataReady = staffResult !== undefined;
  const { showToast } = useToast();
  const [mode, setMode] = useState<UsersMode>("list");
  const [registerSource, setRegisterSource] =
    useState<RegistrationSource | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const refreshList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: prototypeKeys.staffUsers() });
  }, [queryClient]);

  const existingEmails = useMemo(
    () => new Set(staff.map((u) => u.email.toLowerCase())),
    [staff],
  );

  const handleAdd = useCallback(
    (user: StaffUser) => {
      void refreshList();
      showToast(`تمت إضافة «${user.name}» بنجاح.`, "success");
    },
    [refreshList, showToast],
  );

  useEffect(() => {
    // Department admins should never enter source-selector mode.
    if (!preferredSource) return;
    if (mode === "portal") {
      setRegisterSource(preferredSource);
      setMode("register");
    }
  }, [mode, preferredSource]);

  if (mode === "portal") {
    return (
      <RegistrationPortal
          onSelect={(source) => {
            setRegisterSource(source);
            setMode("register");
          }}
          onBack={() => setMode("list")}
        />
    );
  }

  if (mode === "register" && registerSource) {
    return (
      <RegisterUserFlow
          source={registerSource}
          existingEmails={existingEmails}
          submitRegistration={submitRegistration}
          onComplete={handleAdd}
          onBack={() => {
            void refreshList();
            setMode("list");
          }}
          onAddAnother={() => {
            if (preferredSource) {
              setRegisterSource(preferredSource);
              setMode("register");
            } else {
              setMode("portal");
            }
          }}
        />
    );
  }

  return (
    <SubpagePanel>
        <SubpageHeader title={`${usersTitleForSource(preferredSource)}${dataReady ? ` (${staff.length})` : ""}`}>
          {!viewOnly ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => {
                if (preferredSource) {
                  setRegisterSource(preferredSource);
                  setMode("register");
                  return;
                }
                setMode("portal");
              }}
            >
              {addButtonLabel(preferredSource)}
            </Button>
          ) : (
            <Badge tone="default" className="rounded-[20px] px-2.5 py-0.5 text-[11px] font-normal">
              اطلاع فقط
            </Badge>
          )}
        </SubpageHeader>
        {loadError ? (
          <Note tone="danger" className="mx-6 mb-3">
            {loadError}
          </Note>
        ) : null}
        <Table pending={!dataReady}>
          <THead>
            <Tr hoverable={false}>
              <Th>الاسم</Th>
              <Th>المسمى / نوع التوظيف</Th>
              <Th>البريد الإلكتروني</Th>
              <Th>رقم الجوال</Th>
              {!viewOnly ? <Th>إجراء</Th> : null}
            </Tr>
          </THead>
          <TBody>
            {!dataReady ? (
              <SkeletonTableRows rows={6} cols={viewOnly ? 4 : 5} />
            ) : loadError ? (
              <Tr hoverable={false}>
                <Td colSpan={viewOnly ? 4 : 5} className="text-center text-text-3">
                  —
                </Td>
              </Tr>
            ) : dataReady && staff.length === 0 ? (
              <Tr hoverable={false}>
                <Td colSpan={viewOnly ? 4 : 5} className="text-center text-text-3">
                  {usersEmptyForSource(preferredSource)}
                </Td>
              </Tr>
            ) : dataReady ? (
              staff.map((u) => {
                const empType = u.details?.find(
                  (d) => d.label === "نوع التوظيف",
                )?.value;
                const roleLabel = empType ? `${u.role} · ${empType}` : u.role;
                const inactive = u.status === "Inactive";
                return (
                <Tr key={u.id} hoverable={false}>
                  <Td className="text-[11px] font-semibold">
                    {u.name}
                    {inactive ? (
                      <Badge tone="default" className="ms-2 rounded-[20px] px-2 py-0 text-[10px]">
                        معطّل
                      </Badge>
                    ) : null}
                  </Td>
                  <Td className="text-[11px] text-text-2">{roleLabel}</Td>
                  <Td className="text-[11px] text-primary-light [direction:ltr] text-right">
                    {u.email}
                  </Td>
                  <Td className="text-[11px] text-text-2 [direction:ltr] text-right">
                    {u.phone ?? "—"}
                  </Td>
                  {!viewOnly ? (
                    <Td>
                      {!inactive ? (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={deactivatingId === u.id}
                          disabled={deactivatingId !== null}
                          onClick={() => {
                            setDeactivatingId(u.id);
                            void deactivateStaffUser(u.id).then((result) => {
                              setDeactivatingId(null);
                              if (!result.ok) {
                                showToast(result.message, "error");
                                return;
                              }
                              void refreshList();
                              showToast(`تم تعطيل «${u.name}».`, "success");
                            });
                          }}
                        >
                          تعطيل
                        </Button>
                      ) : (
                        "—"
                      )}
                    </Td>
                  ) : null}
                </Tr>
                );
              })
            ) : null}
          </TBody>
        </Table>
      </SubpagePanel>
  );
}

