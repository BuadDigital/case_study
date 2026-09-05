"use client";

/**
 * Keys screen — composition only. Workflow lives in `useKeysViewWorkflow`;
 * each region (`KeysViewKpiBand`, `KeysViewToolbar`, `KeysViewTable`,
 * `KeysViewMobileCards`, `KeysViewModals`) renders one slice of the returned
 * bag. The detail page and the fees report replace the list when routed to.
 */
import dynamic from "next/dynamic";
import { PageShell, PanelSkeleton } from "@platform/ui-kit";
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
      <PageShell variant="canvas" className="min-h-0 flex-1 space-y-0">
        <KeyEnvelopeDetailPage
          envelopeId={detailId}
          canEdit={canEditEnvelope}
          onBack={closeEnvelope}
          onChanged={() => invalidateEnvelopes()}
          backLabel={fromFees ? "تقرير الأتعاب" : "محفظة المفاتيح"}
        />
      </PageShell>
    );
  }

  if (listTab === "fees") {
    return (
      <PageShell variant="canvas" className="min-h-0 flex-1 space-y-0">
        <KeyEnvelopeFeesPanel
          canCollect={canCollectFee}
          onOpenEnvelope={(id) => openEnvelope(id)}
          onBack={backToList}
        />
        {registerModal}
      </PageShell>
    );
  }

  return (
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
  );
}
