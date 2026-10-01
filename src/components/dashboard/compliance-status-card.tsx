import Link from "next/link";

export function ComplianceStatusCard({ status, reason }: { status: string | null; reason: string | null }) {
  if (status !== "rejected" && status !== "suspended") return null;

  const content = status === "rejected"
    ? { title: "Tu página necesita cambios", body: reason ?? "Revisa tus datos y las reglas de uso antes de volver a enviar el perfil." }
    : { title: "Recepción de tips suspendida", body: reason ?? "Contacta a soporte para revisar tu cuenta." };

  return <section className="mb-6 rounded-2xl border border-border bg-surface-soft p-5">
    <h2 className="font-semibold">{content.title}</h2>
    <p className="mt-1 text-sm text-muted">{content.body}</p>
    <Link href="/dashboard/settings" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-accent-strong underline">Revisar mi perfil</Link>
  </section>;
}
