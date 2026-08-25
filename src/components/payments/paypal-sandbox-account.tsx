import Link from "next/link";
import { CheckCircle, Flask } from "@phosphor-icons/react/dist/ssr";

export function PayPalSandboxAccount() {
  return <div className="rounded-2xl border border-[#0070e0]/25 bg-[#0070e0]/5 p-5">
    <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#0070e0] text-white"><Flask size={22} weight="fill" /></span><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0070e0]">PayPal Sandbox</p><p className="mt-1 flex items-center gap-1.5 font-semibold"><CheckCircle className="text-success" weight="fill" /> Cuenta de prueba conectada</p></div></div>
    <p className="mt-4 text-sm leading-relaxed text-muted">Podrás probar el checkout, la confirmación y las notificaciones reales de Sandbox. El dinero de prueba llegará a la cuenta Sandbox de TipMe y no se distribuirá realmente a tu cuenta.</p>
    <p className="mt-3 rounded-xl bg-surface p-3 text-xs leading-relaxed text-muted">La conexión individual y la comisión automática se activarán cuando PayPal apruebe Multiparty.</p>
    <Link href="/onboarding?step=3" className="pressable mt-5 flex min-h-12 items-center justify-center rounded-full bg-accent px-5 font-bold text-on-accent">Continuar</Link>
  </div>;
}
