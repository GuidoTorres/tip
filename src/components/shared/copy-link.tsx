"use client";

import { useState } from "react";
import { Check, ClipboardText } from "@phosphor-icons/react";

export function CopyLink({ url, label = "Copiar mi link", iconOnly = false, inverse = false }: { url: string; label?: string; iconOnly?: boolean; inverse?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  if (iconOnly) return <button type="button" onClick={copy} aria-label={copied ? "Link copiado" : "Copiar link"} title={copied ? "Link copiado" : "Copiar link"} className={`pressable grid size-11 shrink-0 place-items-center rounded-full text-accent-strong ${inverse ? "hover:bg-background/10" : "hover:bg-surface-soft"}`}>{copied ? <Check size={20} weight="bold" className="text-success" /> : <ClipboardText size={20} weight="bold" />}</button>;
  return <button type="button" onClick={copy} className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 font-semibold hover:border-accent hover:bg-surface-soft">{copied ? <Check size={19} weight="bold" className="text-success" /> : <ClipboardText size={19} weight="bold" className="text-accent-strong" />} {copied ? "Link copiado ✓" : label}</button>;
}
