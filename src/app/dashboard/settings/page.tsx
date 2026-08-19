import Image from "next/image";
import { redirect } from "next/navigation";
import { Trash } from "@phosphor-icons/react/dist/ssr";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { ApplicationCurrencyField } from "@/components/shared/application-currency-field";
import { PushSetup } from "@/components/push/push-setup";
import { deleteAvatar, updateSettings } from "@/features/profiles/actions";

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("public_name,username,avatar_url,bio,locale").eq("id", user.id).single();
  const vapidPublicKey = getPublicEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  return <div className="mx-auto max-w-2xl">
    <h1 className="text-3xl font-semibold tracking-[-0.04em]">Configuración</h1>
    {query.success && <p className="mt-5 rounded-xl bg-surface-soft p-3 text-sm font-semibold text-success">Cambios guardados.</p>}
    {query.error && <p role="alert" className="mt-5 rounded-xl bg-surface-soft p-3 text-sm font-semibold text-accent-strong">No pudimos guardar los cambios. Revisa los datos.</p>}
    <section className="mt-7 rounded-2xl border border-border bg-surface p-6">
      <div aria-label="Perfil y notificaciones" className="flex items-center justify-between gap-5">
        <div className="relative size-18">
          {profile?.avatar_url ? <Image src={profile.avatar_url} alt="Tu foto de perfil" width={72} height={72} className="size-18 rounded-2xl object-cover" /> : <div aria-label={`Inicial de ${profile?.public_name ?? "tu cuenta"}`} className="grid size-18 place-items-center rounded-2xl bg-accent text-2xl font-bold text-on-accent">{(profile?.public_name ?? "T").charAt(0)}</div>}
          {profile?.avatar_url && <form action={deleteAvatar} className="absolute -bottom-2 -right-2"><button aria-label="Borrar foto" title="Borrar foto" className="pressable grid size-11 place-items-center rounded-full border border-border bg-surface text-muted hover:text-foreground"><Trash size={18} /></button></form>}
        </div>
        <div aria-label="Control de notificaciones" className="ml-auto min-w-0 text-right"><p className="mb-2 text-sm font-semibold">Notificaciones</p><PushSetup vapidPublicKey={vapidPublicKey} compact /></div>
      </div>
      <form aria-label="Datos del perfil" action={updateSettings} className="mt-7 space-y-5">
        <label className="block text-sm font-semibold">Nueva foto<input type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/avif" className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-soft file:px-4 file:py-3 file:font-semibold" /></label>
        <label className="block text-sm font-semibold">Nombre visible<input className={inputClass} name="publicName" required maxLength={80} defaultValue={profile?.public_name ?? ""} /></label>
        <label className="block text-sm font-semibold">Username<input className={inputClass} name="username" required minLength={3} maxLength={30} defaultValue={profile?.username ?? ""} /><span className="mt-2 block font-normal text-muted">Define tu enlace público: tipme.pro/username</span></label>
        <label className="block text-sm font-semibold">Descripción<textarea className={`${inputClass} min-h-24 py-3`} name="bio" maxLength={180} defaultValue={profile?.bio ?? ""} /></label>
        <ApplicationCurrencyField />
        <label className="block text-sm font-semibold">Idioma<select className={inputClass} name="locale" defaultValue={profile?.locale ?? "es"}><option value="es">Español</option><option value="en">English</option></select></label>
        <button className="pressable min-h-14 w-full rounded-full bg-accent px-6 font-bold text-on-accent">Guardar cambios</button>
      </form>
    </section>
  </div>;
}
