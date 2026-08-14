import Link from "next/link";

export function AuthShell({ title, body, children, alternate }: { title: string; body: string; children: React.ReactNode; alternate: { href: string; label: string } }) {
  return (
    <main className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)] sm:p-8">
        <Link href="/" className="text-xl font-bold tracking-[-0.04em]">TipMe<span className="text-accent">.</span></Link>
        <h1 className="mt-10 text-3xl font-semibold tracking-[-0.04em]">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        {children}
        <Link href={alternate.href} className="mt-6 block text-center text-sm font-semibold text-accent hover:text-accent-strong">{alternate.label}</Link>
      </section>
    </main>
  );
}

export function AuthFields({ buttonLabel }: { buttonLabel: string }) {
  return <div className="mt-8 space-y-5"><label className="block text-sm font-semibold">Email<input name="email" type="email" autoComplete="email" required className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent" /></label><label className="block text-sm font-semibold">Contraseña<input name="password" type="password" autoComplete="current-password" minLength={8} required className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent" /></label><button className="pressable min-h-14 w-full rounded-full bg-accent px-6 py-4 font-bold text-on-accent hover:bg-accent-strong">{buttonLabel}</button></div>;
}

