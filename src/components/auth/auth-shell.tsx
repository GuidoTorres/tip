import Link from "next/link";
import { PasswordField } from "./password-field";

export function AuthShell({ title, body, children, alternate }: { title: string; body: string; children: React.ReactNode; alternate: { href: string; label: string } }) {
  return (
    <main className="grid min-h-[100dvh] place-items-center px-4 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)] sm:p-8">
        <Link href="/" className="text-xl font-bold tracking-[-0.04em]">TipMe<span className="text-accent-strong">.</span></Link>
        <h1 className="mt-10 text-3xl font-semibold tracking-[-0.04em]">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        {children}
        <Link href={alternate.href} className="mt-6 block text-center text-sm font-semibold text-accent-strong hover:text-accent-pressed">{alternate.label}</Link>
      </section>
    </main>
  );
}

export function AuthFields({ buttonLabel, mode }: { buttonLabel: string; mode: "login" | "signup" }) {
  return <div className="mt-8 space-y-5"><label className="block text-sm font-semibold">Email<input name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/40" /></label><PasswordField mode={mode} /><button className="pressable min-h-14 w-full rounded-full bg-accent-strong px-6 py-4 font-bold text-on-accent hover:bg-accent-pressed">{buttonLabel}</button></div>;
}

