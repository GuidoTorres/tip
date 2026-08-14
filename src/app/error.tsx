"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-[100dvh] place-items-center px-4"><div className="max-w-sm text-center"><h1 className="text-2xl font-semibold">No pudimos cargar TipMe</h1><p className="mt-2 text-muted">Comprueba tu conexión e inténtalo nuevamente.</p><button type="button" onClick={reset} className="pressable mt-7 rounded-full bg-accent px-6 py-3 font-semibold text-on-accent">Reintentar</button></div></main>;
}
