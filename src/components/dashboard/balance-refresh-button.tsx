"use client";

import { ArrowClockwise } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function BalanceRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const label = isPending ? "Actualizando saldo" : "Actualizar saldo";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className="pressable grid size-11 shrink-0 place-items-center rounded-full border border-background/20 text-background/75 transition-colors hover:bg-background/10 hover:text-background disabled:cursor-wait disabled:opacity-60"
    >
      <ArrowClockwise
        size={20}
        weight="bold"
        className={isPending ? "animate-spin" : undefined}
      />
    </button>
  );
}
