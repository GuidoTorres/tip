import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-[100dvh] place-items-center px-4"><div className="max-w-sm text-center"><p className="text-6xl">404</p><h1 className="mt-4 text-2xl font-semibold">Esta página no existe</h1><p className="mt-2 text-muted">Revisa el link e inténtalo nuevamente.</p><Link href="/" className="mt-7 inline-flex rounded-full bg-accent px-6 py-3 font-semibold text-on-accent">Ir a TipMe</Link></div></main>;
}

