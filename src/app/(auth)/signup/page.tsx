import { AuthFields, AuthShell } from "@/components/auth/auth-shell";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { signup } from "@/features/auth/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthShell title="Crea tu página" body="Empieza en segundos y recibe tips con tu propio link." alternate={{ href: "/login", label: "Ya tengo una cuenta" }}>{error && <p role="alert" className="mt-5 rounded-xl bg-surface-soft p-3 text-sm text-accent-strong">No pudimos crear la cuenta. Revisa tus datos.</p>}<GoogleAuthButton next="/onboarding" /><form action={signup}><AuthFields buttonLabel="Crear cuenta" mode="signup" /></form></AuthShell>;
}
