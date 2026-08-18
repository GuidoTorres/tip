import Link from "next/link";
import { PaypalLogo } from "@phosphor-icons/react/dist/ssr";

export function PayPalConnect({ connected, cardEnabled }: { connected: boolean; cardEnabled: boolean }) {
  if (connected) {
    return <div className="rounded-2xl bg-surface-soft p-5">
      <strong className="text-success">PayPal conectado</strong>
      <p className="mt-1 text-sm text-muted">{cardEnabled ? "Puedes recibir tips con tarjeta y PayPal." : "Puedes recibir con PayPal. Los pagos con tarjeta dependen de la aprobación de PayPal."}</p>
      <Link href="/onboarding?step=3" className="pressable mt-5 flex min-h-12 items-center justify-center rounded-full bg-accent px-5 font-bold text-on-accent">Continuar</Link>
    </div>;
  }
  return <div>
    <div className="rounded-2xl bg-surface-soft p-5 text-sm text-muted">PayPal verificará tu cuenta y administrará tus datos financieros. TipMe no tendrá acceso a tu contraseña ni a tu banco.</div>
    <form method="post" action="/api/paypal/onboarding" className="mt-5"><button className="pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#0070e0] px-6 py-4 font-bold text-white hover:bg-[#005ea6]"><PaypalLogo size={22} weight="fill" /> Conectar PayPal</button></form>
  </div>;
}
