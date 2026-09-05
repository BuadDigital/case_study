"use client";

/**
 * All non-rendering workflow behind `KeysView`: the envelope query, role
 * gates, URL-driven tab / register / detail state, search and custody
 * filters, the KPI and mobile-card projections, and the delete flow. The view
 * consumes the returned bag and keeps JSX plus event wiring only.
 */
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";
import {
  useShowAllEyeBlink,
  useToast,
  type RowMoreMenuItem,
} from "@platform/ui-kit";
import type { ActiveQueueMobileCardItem } from "@platform/app-shared/components/ActiveQueueMobileCards";
import { removeKeyEnvelope } from "../lib/keys-envelope-api";
import {
  envelopeDisplayRef,
  envelopeStatusColor,
  envelopeStatusLabel,
  isEnvelopeOutOfCustody,
  type KeyEnvelopeRow,
} from "../lib/keys-envelope-types";
import {
  useInvalidateKeyEnvelopes,
  useKeyEnvelopesQuery,
} from "../query/keys-queries";
import {
  computeKeysKpis,
  envelopeCardMeta,
  envelopeCardTone,
  filterKeyEnvelopes,
  keysListHref,
  keysViewPermissions,
  listTabFromParam,
  type ListTab,
  type StatusFilter,
} from "./keys-view-state";

export function useKeysViewWorkflow() {
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, hasCapability } = useAppAccess();
  const { canEditEnvelope, canRegisterEnvelope, canCollectFee } =
    keysViewPermissions({
      role,
      superAdmin: isSuperAdmin(role),
      hasCapability,
    });

  const envelopesQuery = useKeyEnvelopesQuery();
  const invalidateEnvelopes = useInvalidateKeyEnvelopes();
  const envelopes = envelopesQuery.data ?? [];
  const ready = !envelopesQuery.isPending;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showOut, setShowOut] = useState(false);
  const { blink: eyeBlink, toggleOpen } = useShowAllEyeBlink();
  const [listTab, setListTab] = useState<ListTab>("envelopes");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<KeyEnvelopeRow | null>(
    null,
  );
  const registerRequestPrefill =
    searchParams.get("request")?.trim() || undefined;
  const registerTaskId = searchParams.get("task")?.trim() || undefined;
  const fromFees = searchParams.get("tab") === "fees";

  useEffect(() => {
    setListTab(listTabFromParam(searchParams.get("tab")));
    if (searchParams.get("register") === "1" && canRegisterEnvelope) {
      setRegisterOpen(true);
    }
    const envelope = searchParams.get("envelope")?.trim() || null;
    setDetailId(envelope);
  }, [searchParams, canRegisterEnvelope]);

  function openRegisterModal() {
    setRegisterOpen(true);
  }

  function closeRegisterModal() {
    setRegisterOpen(false);
    if (searchParams.get("register") === "1") {
      router.replace(keysListHref(fromFees ? { tab: "fees" } : undefined));
    }
  }

  function openEnvelope(id: string) {
    const fromFeesTab = listTab === "fees" || fromFees;
    router.replace(
      keysListHref(
        fromFeesTab ? { tab: "fees", envelope: id } : { envelope: id },
      ),
    );
  }

  function closeEnvelope() {
    router.replace(keysListHref(fromFees ? { tab: "fees" } : undefined));
  }

  function backToList() {
    router.replace(keysListHref());
  }

  function handleRegistered(id: string) {
    invalidateEnvelopes();
    openEnvelope(id);
  }

  const kpis = useMemo(() => computeKeysKpis(envelopes), [envelopes]);

  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(
    () =>
      filterKeyEnvelopes(envelopes, {
        query: deferredSearch,
        statusFilter,
        showOut,
      }),
    [envelopes, deferredSearch, statusFilter, showOut],
  );

  const mobileCardItems = useMemo((): ActiveQueueMobileCardItem[] => {
    return filtered.map((env) => {
      const out = isEnvelopeOutOfCustody(env.status);
      const stColor = envelopeStatusColor(env.status);
      const moreItems: RowMoreMenuItem[] = canRegisterEnvelope
        ? [
            {
              id: "delete",
              label: "حذف الظرف",
              onClick: () => setPendingDelete(env),
            },
          ]
        : [];
      return {
        id: env.id,
        title: envelopeDisplayRef(env.id, env.createdAtUtc, env.referenceNumber),
        meta: envelopeCardMeta(env),
        statusLabel: envelopeStatusLabel(env.status),
        statusStyle: { base: stColor, fg: stColor },
        tone: envelopeCardTone(env),
        muted: out,
        moreItems,
        onOpen: () => openEnvelope(env.id),
      };
    });
    // Same deps as before the split: the cards follow the rows and the delete gate only.
  }, [filtered, canRegisterEnvelope]);

  async function confirmDeleteEnvelope() {
    const env = pendingDelete;
    if (!env) return;

    setDeletingId(env.id);
    const result = await removeKeyEnvelope(env.id);
    setDeletingId(null);
    setPendingDelete(null);
    if (result.ok) {
      if (detailId === env.id) closeEnvelope();
      invalidateEnvelopes();
      showToast("تم حذف الظرف", "success");
    } else {
      showToast(result.error, "error");
    }
  }

  return {
    ready,
    kpis,
    filtered,
    mobileCardItems,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    showOut,
    eyeBlink,
    toggleShowOut: () => setShowOut(toggleOpen),
    listTab,
    fromFees,
    detailId,
    registerOpen,
    registerRequestPrefill,
    registerTaskId,
    openRegisterModal,
    closeRegisterModal,
    handleRegistered,
    openEnvelope,
    closeEnvelope,
    backToList,
    invalidateEnvelopes,
    pendingDelete,
    setPendingDelete,
    deletingId,
    confirmDeleteEnvelope,
    canEditEnvelope,
    canRegisterEnvelope,
    canCollectFee,
  };
}

export type KeysViewWorkflow = ReturnType<typeof useKeysViewWorkflow>;
