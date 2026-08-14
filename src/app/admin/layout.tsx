import Link from "next/link";
import { requireAdmin } from "@/features/admin/guard";

const links = [["/admin", "Resumen"], ["/admin/creators", "Creadores"], ["/admin/tips", "Tips"], ["/admin/payouts", "Retiros"], ["/admin/webhooks", "Webhooks"]];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="min-h-[100dvh]"><header className="border-b border-border"><div className="mx-auto flex min-h-16 max-w-6xl items-center gap-5 overflow-x-auto px-4"><Link href="/admin" className="shrink-0 text-xl font-bold">TipMe Admin</Link>{links.map(([href, label]) => <Link key={href} href={href} className="shrink-0 text-sm font-semibold text-muted hover:text-foreground">{label}</Link>)}</div></header><main className="mx-auto max-w-6xl px-4 py-8">{children}</main></div>;
}

