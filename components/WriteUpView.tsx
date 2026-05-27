"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import {
  generateFullEstimateWriteUp,
  generateHtmlWriteUp,
  resolveEstimateWriteUp,
} from "@/lib/writeup";

async function copyToClipboard(plain: string, html: string): Promise<boolean> {
  // Try the modern Clipboard API with both text/plain AND text/html
  try {
    if (
      typeof ClipboardItem !== "undefined" &&
      navigator.clipboard &&
      "write" in navigator.clipboard
    ) {
      const item = new ClipboardItem({
        "text/plain": new Blob([plain], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
    // Fallback: plain text only
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(plain);
      return true;
    }
  } catch {
    // Fall through to legacy approach
  }
  // Legacy execCommand fallback
  try {
    const textarea = document.createElement("textarea");
    textarea.value = plain;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export default function WriteUpView() {
  const {
    activeEstimateId,
    estimates,
    activeTrees,
    loadTreesForActiveEstimate,
    updateEstimate,
  } = useAppStore();

  const [draft, setDraft] = useState<string>("");
  const [savedToast, setSavedToast] = useState<string | null>(null);

  const activeEstimate = useMemo(
    () => estimates.find((e) => e.id === activeEstimateId),
    [estimates, activeEstimateId]
  );

  useEffect(() => {
    loadTreesForActiveEstimate();
  }, [activeEstimateId, loadTreesForActiveEstimate]);

  useEffect(() => {
    setDraft(resolveEstimateWriteUp(activeEstimate, activeTrees));
  }, [activeEstimate, activeTrees]);

  useEffect(() => {
    if (!savedToast) return;
    const t = setTimeout(() => setSavedToast(null), 2500);
    return () => clearTimeout(t);
  }, [savedToast]);

  const generated = useMemo(
    () => generateFullEstimateWriteUp(activeTrees),
    [activeTrees]
  );

  const isOverride = !!activeEstimate?.writeUp?.trim();
  const isModified =
    draft !== resolveEstimateWriteUp(activeEstimate, activeTrees);

  const handleSave = async () => {
    if (!activeEstimateId) return;
    await updateEstimate(activeEstimateId, { writeUp: draft });
    setSavedToast("Saved");
  };

  const handleResetToAuto = async () => {
    if (!activeEstimateId) return;
    await updateEstimate(activeEstimateId, { writeUp: undefined });
    setDraft(generated);
    setSavedToast("Reset to auto-generated");
  };

  const handleCopy = async () => {
    // If the user edited the text, copy what they have verbatim.
    // Plain version comes from the textarea. HTML uses the structured generator
    // ONLY when the draft matches the auto output (so we preserve manual edits as plain).
    const plain = draft;
    const html =
      draft === generated
        ? generateHtmlWriteUp(activeTrees)
        : draftToHtml(draft);
    const ok = await copyToClipboard(plain, html);
    setSavedToast(ok ? "Copied to clipboard" : "Copy failed");
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--ios-bg)] ios-scroll">
      <div className="px-3 py-6 pb-24">
        <h1 className="text-[28px] font-bold tracking-tight text-gray-900 px-1 mb-4">
          Write-Up
        </h1>

        {!activeEstimateId && (
          <div className="bg-white rounded-xl border border-gray-200/70 p-6 text-center">
            <p className="text-[15px] text-gray-500">No active estimate</p>
            <p className="text-[13px] text-gray-400 mt-1">
              Swipe to Camera to start one
            </p>
          </div>
        )}

        {activeEstimateId && activeTrees.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200/70 p-6 text-center">
            <p className="text-[15px] text-gray-500">No trees yet</p>
            <p className="text-[13px] text-gray-400 mt-1">
              Add a tree to generate the write-up
            </p>
          </div>
        )}

        {activeEstimateId && activeTrees.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[12px] text-gray-500">
                {isOverride
                  ? "Edited (custom write-up)"
                  : "Auto-generated from scope and notes"}
              </p>
              {isOverride && (
                <button
                  onClick={handleResetToAuto}
                  className="text-[12px] text-emerald-700 font-medium active:text-emerald-800"
                >
                  Reset to auto
                </button>
              )}
            </div>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={18}
              className="w-full rounded-2xl border border-gray-200/70 px-4 py-3 text-[15px] leading-relaxed bg-white resize-none"
              placeholder="Write-up will appear here..."
              style={{ fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}
            />

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 rounded-2xl bg-emerald-600 py-3.5 text-white text-[15px] font-semibold active:bg-emerald-700 flex items-center justify-center gap-2"
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
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </button>
              <button
                onClick={handleSave}
                disabled={!isModified}
                className="flex-1 rounded-2xl bg-white border border-gray-200/70 py-3.5 text-gray-800 text-[15px] font-semibold active:bg-gray-50 disabled:opacity-40"
              >
                Save changes
              </button>
            </div>

            <p className="mt-3 px-1 text-[12px] text-gray-500 leading-relaxed">
              Tap Copy to paste into Mail, Messages, or Notes. Formatting (bold
              names, line breaks) is preserved where supported.
            </p>
          </>
        )}

        {savedToast && (
          <div
            className="fixed bottom-20 left-1/2 -translate-x-1/2 max-w-[90%] rounded-2xl bg-gray-900 px-4 py-2.5 text-[14px] font-medium text-white shadow-xl z-30 pointer-events-none"
            role="status"
          >
            {savedToast}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Convert manually-edited plain text to a simple HTML version for the clipboard.
 * Heuristic: lines that look like a name (short, no period) are bolded;
 * lines that start with "Q:" or "$" are bolded; blank lines become paragraph breaks.
 */
function draftToHtml(text: string): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const lines = text.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) return;
    blocks.push(current.join("<br>"));
    current = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const escaped = escape(line);
    // Bold heuristic: starts with Q:, or is short (<30 chars) and has no period
    const isPrice = /^Q:|^\$/.test(line);
    const isHeader = line.length < 40 && !/\.$/.test(line) && !line.includes(",");
    if (isPrice || isHeader) {
      current.push(`<strong>${escaped}</strong>`);
    } else {
      current.push(escaped);
    }
  }
  flush();

  return blocks.map((b) => `<p>${b}</p>`).join("");
}