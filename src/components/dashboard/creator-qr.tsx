"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { QrCode, X } from "@phosphor-icons/react";
import { ShareQrButton } from "@/components/dashboard/share-qr-button";

type CreatorQrProps = {
  publicUrl: string;
  username: string;
  iconOnly?: boolean;
  inverse?: boolean;
};

export function CreatorQr({ publicUrl, username, iconOnly = false, inverse = false }: CreatorQrProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  async function generate() {
    if (dataUrl || loading) return;
    setLoading(true);
    setError(false);
    try {
      const { generatePublicProfileQr } = await import("@/features/profiles/qr-code");
      setDataUrl(await generatePublicProfileQr(publicUrl));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function show() {
    setOpen(true);
    void generate();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button type="button" onClick={show} aria-label={iconOnly ? "Mostrar QR" : undefined} title={iconOnly ? "Mostrar QR" : undefined} className={iconOnly ? `pressable grid size-11 shrink-0 place-items-center rounded-full text-accent-strong ${inverse ? "hover:bg-background/10" : "hover:bg-surface-soft"}` : "pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 font-semibold hover:border-accent hover:bg-surface-soft"}>
        <QrCode size={20} weight="bold" className="text-accent-strong" /> {!iconOnly && "Mostrar QR"}
      </button>
      <dialog ref={dialogRef} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) close(); }} aria-labelledby="creator-qr-title" className="m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-2xl border border-border bg-surface p-0 text-foreground backdrop:bg-foreground/55 backdrop:backdrop-blur-sm">
        <div className="p-4 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accent-strong">TipMe.</p>
              <h2 id="creator-qr-title" className="mt-1 text-2xl font-semibold tracking-[-0.04em]">Mi QR para recibir tips</h2>
            </div>
            <button type="button" onClick={close} aria-label="Cerrar QR" className="grid size-11 shrink-0 place-items-center rounded-full border border-border text-muted hover:bg-surface-soft hover:text-foreground"><X size={20} weight="bold" /></button>
          </div>
          <div className="mx-auto mt-4 grid aspect-square w-full max-w-[min(100%,42dvh)] place-items-center rounded-2xl bg-white p-4 [@media(max-height:500px)]:mt-2">
            {dataUrl && <Image src={dataUrl} alt={`QR para enviar un tip a @${username}`} width={768} height={768} unoptimized className="h-auto w-full" />}
            {loading && <p className="text-sm font-semibold text-[#222321]">Generando QR…</p>}
            {error && <div className="text-center"><p className="text-sm font-semibold text-[#b83f32]">No pudimos generar el QR.</p><button type="button" onClick={() => { void generate(); }} className="mt-3 min-h-11 rounded-full border border-[#dfe1dc] px-4 text-sm font-semibold text-[#222321]">Intentar nuevamente</button></div>}
          </div>
          <p className="mt-3 truncate text-center font-semibold text-accent-strong [@media(max-height:500px)]:mt-2">{publicUrl.replace(/^https?:\/\//, "")}</p>
          {dataUrl && <div className="mt-4 [@media(max-height:500px)]:mt-2"><ShareQrButton dataUrl={dataUrl} username={username} /></div>}
        </div>
      </dialog>
    </>
  );
}
