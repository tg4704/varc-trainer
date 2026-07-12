// Generates a shareable results card (canvas → PNG) and offers Download,
// Copy-to-clipboard, and the native Share sheet (mobile / supporting
// desktop browsers). There's no direct "post to X/Instagram" button: none of
// the major platforms allow a plain web app to post images to a user's
// account without an approved developer app + per-user OAuth, so instead we
// generate the image and hand off to the OS share sheet — the same pattern
// Duolingo/Spotify Wrapped-style share cards use. The share sheet already
// lists Instagram, X, WhatsApp, etc. on any device that has them installed.
import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { buildResultsShareCard } from "../lib/shareCard.js";

export default function ShareResultsModal({ data, onClose }) {
  const [blob, setBlob] = useState(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [error, setError] = useState(null);
  const [copyState, setCopyState] = useState("idle"); // idle | copied | error
  const urlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    buildResultsShareCard(data)
      .then((b) => {
        if (cancelled) return;
        const url = URL.createObjectURL(b);
        urlRef.current = url;
        setBlob(b);
        setImgUrl(url);
      })
      .catch((e) => !cancelled && setError(e.message || "Couldn't generate the image."));
    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [data]);

  function handleDownload() {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = "graspr-results.png";
    a.click();
  }

  async function handleCopy() {
    if (!blob || !navigator.clipboard || !window.ClipboardItem) return;
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2500);
    }
  }

  async function handleShare() {
    if (!blob) return;
    const file = new File([blob], "graspr-results.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My Graspr results",
          text: `${data.accuracyPct}% accuracy on Graspr Drills`,
        });
      }
    } catch {
      // user cancelled the share sheet — not an error
    }
  }

  const canCopy = typeof window !== "undefined" && !!navigator.clipboard && !!window.ClipboardItem;
  const canShare = typeof window !== "undefined" && !!navigator.canShare;

  return (
    <Modal onClose={onClose} labelledBy="share-results-title">
      <div className="glass-floating w-full max-w-sm p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <h2 id="share-results-title" className="display text-[20px]">Share your results</h2>
        <p className="mt-1 text-xs dim">A ready-made card: download it, copy it, or send it straight to any app.</p>

        <div
          className="mt-4 flex aspect-square items-center justify-center overflow-hidden rounded-[14px]"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border-lo)" }}
        >
          {error ? (
            <p className="px-4 text-center text-sm text-destructive">{error}</p>
          ) : imgUrl ? (
            <img src={imgUrl} alt="Results share card" className="h-full w-full object-contain" />
          ) : (
            <div className="mono text-xs dim">Generating…</div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {canShare && (
            <button onClick={handleShare} disabled={!blob} className="btn btn-primary fx-sheen w-full disabled:opacity-50">
              Share…
            </button>
          )}
          <div className="flex gap-2">
            <button onClick={handleDownload} disabled={!blob} className="btn btn-glass fx-ring flex-1 disabled:opacity-50">
              Download
            </button>
            {canCopy && (
              <button onClick={handleCopy} disabled={!blob} className="btn btn-glass fx-ring flex-1 disabled:opacity-50">
                {copyState === "copied" ? "Copied ✓" : copyState === "error" ? "Couldn't copy" : "Copy image"}
              </button>
            )}
          </div>
          <button onClick={onClose} className="btn btn-glass fx-ring w-full">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
