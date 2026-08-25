import { CheckCircle, Clock, PaypalLogo } from "@phosphor-icons/react/dist/ssr";
import { savePayPalPayoutEmail } from "@/features/profiles/actions";

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent";

export function PayPalPayoutEmailForm({ email = "", status, returnTo }: {
  email?: string;
  status?: "pending" | "verified";
  returnTo: "/onboarding?step=3" | "/dashboard/payouts";
}) {
  return <form action={savePayPalPayoutEmail} className="space-y-5">
    <input type="hidden" name="returnTo" value={returnTo} />
    <label className="block text-sm font-semibold">Correo de tu cuenta PayPal
      <input className={inputClass} type="email" name="paypalEmail" required maxLength={254} autoComplete="email" defaultValue={email} placeholder="tu-correo@ejemplo.com" />
    </label>
    <div className="flex items-start gap-3 rounded-xl bg-surface-soft p-4">
      <PaypalLogo size={24} weight="fill" className="shrink-0 text-[#0070e0]" />
      <div>
        <p className="flex items-center gap-2 font-semibold">{status === "verified" ? <><CheckCircle className="text-success" weight="fill" /> PayPal verificado</> : <><Clock className="text-warning" weight="fill" /> {status === "pending" ? "PayPal configurado" : "Validación automática"}</>}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{status === "verified" ? "Ya completamos un retiro a esta cuenta." : "Confirmaremos que la cuenta puede recibir dinero con el primer retiro exitoso."}</p>
      </div>
    </div>
    <button className="pressable min-h-14 w-full rounded-full bg-accent px-6 font-bold text-on-accent">{returnTo.startsWith("/onboarding") ? "Guardar y continuar" : "Guardar correo PayPal"}</button>
  </form>;
}
