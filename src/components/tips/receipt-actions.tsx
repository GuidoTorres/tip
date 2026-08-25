"use client";

import { Check, Copy, ShareNetwork, SpinnerGap } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export function ReceiptActions({ tipId, token, operationCode, canShare }: {
  tipId: string;
  token: string;
  operationCode: string;
  canShare: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canShare) return;
    let active = true;
    fetch(`/api/tips/${encodeURIComponent(tipId)}/receipt-image?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("receipt_image_failed");
        const blob = await response.blob();
        if (active) setReceiptFile(new File([blob], `tipme-${operationCode}.png`, { type: "image/png" }));
      })
      .catch(() => active && setError("No pudimos preparar la imagen del recibo."));
    return () => { active = false; };
  }, [canShare, operationCode, tipId, token]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(operationCode);
      setCopied(true);
      setError(null);
    } catch {
      setError("No pudimos copiar el código.");
    }
  }

  function downloadReceipt(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function shareReceipt() {
    if (!receiptFile) return;
    setSharing(true);
    setError(null);
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [receiptFile] }))) {
        await navigator.share({ title: "Recibo confirmado de TipMe", text: `Código de operación: ${operationCode}`, files: [receiptFile] });
      } else {
        downloadReceipt(receiptFile);
      }
    } catch (shareError) {
      if (!(shareError instanceof DOMException && shareError.name === "AbortError")) setError("No pudimos compartir el recibo.");
    } finally {
      setSharing(false);
    }
  }

  return <div className="mt-3">
    <div className={`grid gap-2 ${canShare ? "grid-cols-2" : "grid-cols-1"}`}>
      <button type="button" onClick={copyCode} className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold">
        {copied ? <Check size={18} weight="bold" className="text-success" /> : <Copy size={18} />} {copied ? "Copiado" : "Copiar código"}
      </button>
      {canShare && <button type="button" onClick={shareReceipt} disabled={!receiptFile || sharing} className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent-strong px-3 text-sm font-semibold text-on-accent disabled:opacity-60">
        {!receiptFile || sharing ? <SpinnerGap size={18} className="animate-spin" /> : <ShareNetwork size={18} />} Compartir recibo
      </button>}
    </div>
    {error && <p role="alert" className="mt-2 text-xs font-semibold text-accent-strong">{error}</p>}
  </div>;
}
