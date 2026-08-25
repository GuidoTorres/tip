"use client";

import { useState } from "react";
import { DownloadSimple, ShareNetwork } from "@phosphor-icons/react";

type ShareQrButtonProps = {
  dataUrl: string;
  username: string;
};

export function ShareQrButton({ dataUrl, username }: ShareQrButtonProps) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState(false);
  const fileName = `tipme-${username}-qr.png`;

  function download() {
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = fileName;
    anchor.click();
  }

  async function share() {
    setError(false);
    const encoded = dataUrl.split(",")[1];
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    const file = new File([bytes], fileName, { type: "image/png" });

    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      download();
      return;
    }

    setSharing(true);
    try {
      await navigator.share({
        files: [file],
        title: "Mi QR de TipMe",
        text: "Escanea este QR para enviarme un tip.",
      });
    } catch (shareError) {
      if (!(shareError instanceof DOMException && shareError.name === "AbortError")) setError(true);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={share} disabled={sharing} className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent-strong px-4 font-semibold text-on-accent disabled:cursor-not-allowed disabled:opacity-60">
          <ShareNetwork size={20} weight="bold" /> {sharing ? "Compartiendo…" : "Compartir QR"}
        </button>
        <a href={dataUrl} download={fileName} className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border px-4 font-semibold hover:bg-surface-soft">
          <DownloadSimple size={20} weight="bold" /> Descargar
        </a>
      </div>
      {error && <p role="alert" className="mt-3 text-center text-sm font-semibold text-accent-strong">No pudimos compartirlo. Puedes descargar la imagen.</p>}
    </div>
  );
}
