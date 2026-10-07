"use client";

/**
 * Keys screen — composition only. Workflow lives in `useKeysViewWorkflow`;
 * each region (`KeysViewKpiBand`, `KeysViewToolbar`, `KeysViewTable`,
 * `KeysViewMobileCards`, `KeysViewModals`) renders one slice of the returned
 * bag. The detail page and the fees report replace the list when routed to.
 */
import dynamic from "next/dynamic";
import { useRef, type ReactNode } from "react";
import { PageShell, PanelSkeleton, useSwapAnimation } from "@platform/ui-kit";
import { useKeysViewWorkflow } from "./useKeysViewWorkflow";
import { KeysViewKpiBand } from "./KeysViewKpiBand";
import { KeysViewToolbar } from "./KeysViewToolbar";
import { KeysViewMobileCards, KeysViewTable } from "./KeysViewTable";
import {
  KeysDeleteEnvelopeModal,
  KeysRegisterEnvelopeModal,
} from "./KeysViewModals";

const KeyEnvelopeDetailPage = dynamic(
  () =>
    import("../components/KeyEnvelopeDetailModal").then(
      (m) => m.KeyEnvelopeDetailPage,
    ),
  {
    ssr: false,
    loading: () => <PanelSkeleton className="min-h-[40vh] p-4" />,
  },
);
const KeyEnvelopeFeesPanel = dynamic(
  () =>
    import("../components/KeyEnvelopeFeesPanel").then(
      (m) => m.KeyEnvelopeFeesPanel,
    ),
  {
    loading: () => <PanelSkeleton className="min-h-[40vh] p-4" />,
  },
);

/**
 * List, fees report and envelope detail share /keys (search params only), so the
 * shell's page fade does not cover these swaps — this wrapper does.
 */
function KeysSwapPanel({
  swapKey,
  children,
}: {
  swapKey: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useSwapAnimation(ref, swapKey);
  return <div ref={ref}>{children}</div>;
}

export function KeysView() {
  const {
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
    toggleShowOut,
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
  } = useKeysViewWorkflow();
  const swapKey = detailId ?? listTab;

  const registerModal = (
    <KeysRegisterEnvelopeModal
      open={registerOpen}
      onClose={closeRegisterModal}
      initialRequestNumber={registerRequestPrefill}
      operationsTaskId={registerTaskId}
      onRegistered={handleRegistered}
    />
  );

  if (detailId) {
    return (
      <KeysSwapPanel swapKey={swapKey}>
        <PageShell variant="canvas" className="min-h-0 flex-1 space-y-0">
          <KeyEnvelopeDetailPage
            envelopeId={detailId}
            canEdit={canEditEnvelope}
            onBack={closeEnvelope}
            onChanged={() => invalidateEnvelopes()}
            backLabel={fromFees ? "تقرير الأتعاب" : "محفظة المفاتيح"}
          />
        </PageShell>
      </KeysSwapPanel>
    );
  }

  if (listTab === "fees") {
    return (
      <KeysSwapPanel swapKey={swapKey}>
        <PageShell variant="canvas" className="min-h-0 flex-1 space-y-0">
          <KeyEnvelopeFeesPanel
            canCollect={canCollectFee}
            onOpenEnvelope={(id) => openEnvelope(id)}
            onBack={backToList}
          />
          {registerModal}
        </PageShell>
      </KeysSwapPanel>
    );
  }

  return (
    <KeysSwapPanel swapKey={swapKey}>
      <PageShell variant="canvas" className="min-h-0 flex-1 space-y-0">
        <KeysViewKpiBand ready={ready} kpis={kpis} />

        {/* .toolbar — renderKeys */}
        <KeysViewToolbar
          ready={ready}
          resultCount={filtered.length}
          search={search}
          onSearch={setSearch}
          showOut={showOut}
          eyeBlink={eyeBlink}
          onToggleShowOut={toggleShowOut}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          canRegisterEnvelope={canRegisterEnvelope}
          onRegister={openRegisterModal}
        />

        <KeysViewTable
          ready={ready}
          rows={filtered}
          canRegisterEnvelope={canRegisterEnvelope}
          onOpen={openEnvelope}
          onRequestDelete={setPendingDelete}
        />

        <KeysViewMobileCards ready={ready} items={mobileCardItems} />

        {canRegisterEnvelope && filtered.length > 0 ? (
          <p className="m-0 mt-3 hidden text-[11px] text-text-3 lg:block">
            زر يمين على الصف لفتح تأكيد حذف الظرف.
          </p>
        ) : null}

        {registerModal}
        <KeysDeleteEnvelopeModal
          envelope={pendingDelete}
          deletingId={deletingId}
          onConfirm={() => void confirmDeleteEnvelope()}
          onCancel={() => setPendingDelete(null)}
        />
      </PageShell>
    </KeysSwapPanel>
  );
}
