import Link from "next/link";
import { PayPalConnectForm } from "./paypal-connect-form";

export function PayPalConnect({ connected, cardEnabled }: { connected: boolean; cardEnabled: boolean }) {
  if (connected) {
    return <div className="rounded-2xl bg-surface-soft p-5">
      <strong className="text-success">Cuenta PayPal enlazada</strong>
      <p className="mt-1 text-sm text-muted">Ya puedes recibir tips en esta cuenta.</p>
      {!cardEnabled && <p className="mt-2 text-sm text-muted">Los pagos con tarjeta dependen de la aprobación de PayPal.</p>}
      <Link href="/onboarding?step=3" className="pressable mt-5 flex min-h-12 items-center justify-center rounded-full bg-accent px-5 font-bold text-on-accent">Continuar</Link>
    </div>;
  }
  return <div>
    <div className="rounded-2xl bg-surface-soft p-5 text-sm text-muted">PayPal verificará tu cuenta y administrará tus datos financieros. TipMe no tendrá acceso a tu contraseña ni a tu banco.</div>
    <PayPalConnectForm />
  </div>;
}
