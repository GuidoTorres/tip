import Image from "next/image";

export function DashboardProfileHeader({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initial = name.trim().charAt(0).toLocaleUpperCase() || "T";

  return <div className="flex min-w-0 items-center gap-3">
    {avatarUrl
      ? <Image src={avatarUrl} alt={`Foto de perfil de ${name}`} width={48} height={48} className="size-12 shrink-0 rounded-2xl object-cover" priority />
      : <div aria-label={`Inicial de ${name}`} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-lg font-bold text-on-accent">{initial}</div>}
    <div className="min-w-0"><p className="text-sm text-muted">Hola</p><h1 className="truncate text-3xl font-semibold tracking-[-0.04em]">{name}</h1></div>
  </div>;
}
