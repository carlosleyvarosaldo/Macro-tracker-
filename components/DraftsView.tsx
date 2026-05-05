"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Estimate } from "@/types";
import ListGroup from "@/components/ui/ListGroup";
import ListRow from "@/components/ui/ListRow";
import ActionSheet from "@/components/ui/ActionSheet";

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
    currentUser,
    signOut,
  } = useAppStore();

  const [pendingDelete, setPendingDelete] = useState<Estimate | null>(null);
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

        {/* Estimates section */}
        {estimates.length === 0 ? (
          <ListGroup>
            <div className="px-4 py-8 text-center">
              <p className="text-[15px] text-gray-500 mb-1">No estimates yet</p>
              <p className="text-[13px] text-gray-400">
                Swipe to Camera to start one
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
                { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
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
                          setPendingDelete(estimate);
                        }}
                        aria-label="Delete estimate"
                        className="w-8 h-8 rounded-full text-gray-400 active:text-red-600 active:bg-gray-100 flex items-center justify-center"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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
    </div>
  );
}