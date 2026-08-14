"use client";

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";

export function CopyLink({ url, label = "Copiar mi link" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <button type="button" onClick={copy} className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 font-semibold hover:bg-surface-soft">{copied ? <Check size={19} weight="bold" /> : <Copy size={19} />} {copied ? "Link copiado" : label}</button>;
}

