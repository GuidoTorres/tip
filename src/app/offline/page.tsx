import { WifiSlash } from "@phosphor-icons/react/dist/ssr";

export default function OfflinePage() {
  return <main className="grid min-h-[100dvh] place-items-center px-4"><div className="max-w-sm text-center"><WifiSlash size={48} className="mx-auto text-accent-strong" /><h1 className="mt-5 text-2xl font-semibold">Estás sin conexión</h1><p className="mt-2 text-muted">Cuando recuperes internet, vuelve a intentar. Tu saldo no se modifica sin confirmación del servidor.</p></div></main>;
}

