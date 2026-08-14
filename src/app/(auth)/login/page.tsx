import { AuthFields, AuthShell } from "@/components/auth/auth-shell";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { login } from "@/features/auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const query = await searchParams;
  return <AuthShell title="Bienvenida de vuelta" body="Entra para ver tus tips y tu saldo." alternate={{ href: "/signup", label: "Crear una cuenta" }}>{query.message === "check_email" && <p className="mt-5 rounded-xl bg-surface-soft p-3 text-sm text-success">Revisa tu email para confirmar la cuenta.</p>}{query.error && <p role="alert" className="mt-5 rounded-xl bg-surface-soft p-3 text-sm text-accent-strong">No pudimos iniciar sesión. Inténtalo nuevamente.</p>}<GoogleAuthButton next={query.next ?? "/dashboard"} /><form action={login}><input type="hidden" name="next" value={query.next ?? "/dashboard"} /><AuthFields buttonLabel="Entrar" /></form></AuthShell>;
}
