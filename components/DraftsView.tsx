"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Estimate } from "@/types";
import ListGroup from "@/components/ui/ListGroup";
import ListRow from "@/components/ui/ListRow";
import ActionSheet from "@/components/ui/ActionSheet";
import RenameEstimateSheet from "@/components/RenameEstimateSheet";

type Props = {
  onSelectDraft?: () => void;
};

function estimateDisplayName(estimate: Estimate): string {
  if (estimate.name?.trim()) return estimate.name;
  return `Estimate · ${new Date(estimate.createdAt).toLocaleDateString()}`;
}

export default function DraftsView({ onSelectDraft }: Props) {
  const router = useRouter();
  const {
    estimates,
    loadEstimates,
    setActiveEstimate,
    activeEstimateId,
    deleteEstimate,
    createBlankEstimate,
    updateEstimate,
    currentUser,
    signOut,
  } = useAppStore();

  const [pendingDelete, setPendingDelete] = useState<Estimate | null>(null);
  const [pendingActions, setPendingActions] = useState<Estimate | null>(null);
  const [renaming, setRenaming] = useState<Estimate | null>(null);
  const [signOutSheet, setSignOutSheet] = useState(false);

  useEffect(() => {
    loadEstimates();
  }, [loadEstimates]);

  const handleSelect = async (id: string) => {
    setActiveEstimate(id);
    await useAppStore.getState().loadTreesForActiveEstimate();
    if (onSelectDraft) onSelectDraft();
    else router.push("/");
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    await deleteEstimate(id);
  };

  const handleNewEstimate = async () => {
    const created = await createBlankEstimate();
    setRenaming(created);
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--ios-bg)] ios-scroll">
      <div className="px-3 py-6 pb-24">
        <h1 className="text-[28px] font-bold tracking-tight text-gray-900 px-1 mb-4">
          Drafts
        </h1>

        {/* Account section */}
        {currentUser && (
          <ListGroup header="Account" className="mb-6">
            <ListRow
              leading={
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-semibold">
                  {currentUser.email.charAt(0).toUpperCase()}
                </div>
              }
              title={currentUser.email}
              subtitle="Signed in"
            />
            <ListRow
              title="Sign out"
              destructive
              onClick={() => setSignOutSheet(true)}
              chevron={false}
            />
          </ListGroup>
        )}

        {/* New estimate — the big green pill */}
        <button
          type="button"
          onClick={handleNewEstimate}
          className="w-full mb-6 rounded-3xl bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-[17px] py-5 flex items-center justify-center gap-2 shadow-sm"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New estimate
        </button>

        {/* Estimates section */}
        {estimates.length === 0 ? (
          <ListGroup>
            <div className="px-4 py-8 text-center">
              <p className="text-[15px] text-gray-500 mb-1">No estimates yet</p>
              <p className="text-[13px] text-gray-400">
                Tap the green button or swipe to Camera to start one
              </p>
            </div>
          </ListGroup>
        ) : (
          <ListGroup
            header={`${estimates.length} ${
              estimates.length === 1 ? "estimate" : "estimates"
            }`}
          >
            {estimates.map((estimate) => {
              const isActive = estimate.id === activeEstimateId;
              const displayName = estimateDisplayName(estimate);
              const dateText = new Date(estimate.createdAt).toLocaleString(
                undefined,
                {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }
              );
              return (
                <div key={estimate.id} className="relative">
                  <ListRow
                    title={displayName}
                    subtitle={dateText}
                    onClick={() => handleSelect(estimate.id)}
                    leading={
                      isActive ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-transparent" />
                      )
                    }
                    trailing={
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingActions(estimate);
                        }}
                        aria-label="More actions"
                        className="w-8 h-8 rounded-full text-gray-400 active:text-gray-600 active:bg-gray-100 flex items-center justify-center"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <circle cx="5" cy="12" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="19" cy="12" r="2" />
                        </svg>
                      </button>
                    }
                  />
                </div>
              );
            })}
          </ListGroup>
        )}
      </div>

      {/* Per-estimate action sheet (rename / delete) */}
      <ActionSheet
        open={pendingActions !== null}
        onClose={() => setPendingActions(null)}
        title={pendingActions ? estimateDisplayName(pendingActions) : ""}
        actions={
          pendingActions
            ? [
                {
                  label: "Rename",
                  onClick: () => {
                    const target = pendingActions;
                    setPendingActions(null);
                    setRenaming(target);
                  },
                },
                {
                  label: "Delete",
                  destructive: true,
                  onClick: () => {
                    const target = pendingActions;
                    setPendingActions(null);
                    setPendingDelete(target);
                  },
                },
              ]
            : []
        }
      />

      {/* Delete confirm sheet */}
      <ActionSheet
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete estimate?"
        description={
          pendingDelete
            ? `${estimateDisplayName(pendingDelete)} and all its trees will be removed. This cannot be undone.`
            : ""
        }
        actions={[
          {
            label: "Delete",
            destructive: true,
            onClick: confirmDelete,
          },
        ]}
      />

      {/* Sign out confirm sheet */}
      <ActionSheet
        open={signOutSheet}
        onClose={() => setSignOutSheet(false)}
        title="Sign out?"
        description="Your data stays on this device. Sign back in anytime."
        actions={[
          {
            label: "Sign out",
            destructive: true,
            onClick: () => {
              setSignOutSheet(false);
              signOut();
            },
          },
        ]}
      />

      {/* Rename sheet */}
      <RenameEstimateSheet
        open={renaming !== null}
        initialName={renaming?.name ?? ""}
        initialAddress={renaming?.address}
        onClose={() => setRenaming(null)}
        onSave={async (newName) => {
          if (!renaming) return;
          await updateEstimate(renaming.id, { name: newName });
          setRenaming(null);
        }}
      />
    </div>
  );
}