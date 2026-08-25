"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle, SpinnerGap } from "@phosphor-icons/react";
import { validateUsername } from "@/features/profiles/username";
import { ApplicationCurrencyField } from "@/components/shared/application-currency-field";

const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-accent";
type Availability = "idle" | "invalid" | "reserved" | "checking" | "available" | "taken" | "error";

export function OnboardingProfileForm({ action, publicName, username: savedUsername, bio, locale, showCurrency, submitLabel }: {
  action: (formData: FormData) => void | Promise<void>;
  publicName: string;
  username: string;
  bio: string;
  locale: "es" | "en";
  showCurrency: boolean;
  submitLabel: string;
}) {
  const initialUsername = useMemo(() => savedUsername.trim().toLowerCase(), [savedUsername]);
  const [username, setUsername] = useState(initialUsername);
  const [availability, setAvailability] = useState<Availability>(initialUsername ? "available" : "idle");

  useEffect(() => {
    if (availability !== "checking") return;
    const validation = validateUsername(username);
    if (!validation.ok) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/usernames/availability?username=${encodeURIComponent(validation.value)}`, {
          credentials: "same-origin",
          signal: controller.signal,
        });
        const result = await response.json() as { username?: string; available?: boolean };
        if (!response.ok || result.username !== validation.value || typeof result.available !== "boolean") {
          throw new Error("availability_unavailable");
        }
        setAvailability(result.available ? "available" : "taken");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setAvailability("error");
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [availability, username]);

  function updateUsername(rawValue: string) {
    const value = rawValue.toLowerCase().replace(/\s+/g, "");
    const validation = validateUsername(value);
    setUsername(value);
    if (!value) setAvailability("idle");
    else if (!validation.ok) setAvailability(validation.error);
    else if (validation.value === initialUsername && initialUsername) setAvailability("available");
    else setAvailability("checking");
  }

  const status = availabilityMessage(availability);
  const canSubmit = availability === "available";

  return (
    <form action={action} className="mt-7 space-y-5">
      <label className="block text-sm font-semibold">
        Nombre visible
        <input className={inputClass} name="publicName" required maxLength={80} defaultValue={publicName} />
      </label>
      <label className="block text-sm font-semibold">
        Username
        <div className={`mt-2 flex min-h-12 items-center rounded-xl border bg-background px-4 ${availability === "taken" || availability === "invalid" || availability === "reserved" ? "border-accent-strong" : availability === "available" ? "border-success" : "border-border"}`}>
          <span className="text-muted">tipme.pro/</span>
          <input
            name="username"
            required
            minLength={3}
            maxLength={30}
            value={username}
            onChange={(event) => updateUsername(event.target.value)}
            autoCapitalize="none"
            autoComplete="username"
            spellCheck={false}
            aria-invalid={["invalid", "reserved", "taken"].includes(availability)}
            aria-describedby="username-availability"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
          {availability === "checking" && <SpinnerGap size={18} className="animate-spin text-muted" aria-hidden />}
          {availability === "available" && <CheckCircle size={18} className="text-success" weight="fill" aria-hidden />}
        </div>
        <span id="username-availability" aria-live="polite" className={`mt-2 block min-h-5 text-xs ${availability === "available" ? "text-success" : availability === "taken" || availability === "invalid" || availability === "reserved" ? "text-accent-strong" : "text-muted"}`}>
          {status}
        </span>
      </label>
      <label className="block text-sm font-semibold">
        Foto
        <input className="mt-2 block w-full text-sm text-muted" type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/avif" />
      </label>
      <label className="block text-sm font-semibold">
        Descripcion
        <textarea className={`${inputClass} min-h-24 py-3`} name="bio" maxLength={180} defaultValue={bio} />
      </label>
      {showCurrency && <ApplicationCurrencyField />}
      <input type="hidden" name="locale" value={locale} />
      <button disabled={!canSubmit} className="pressable flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent-strong px-6 py-4 font-bold text-on-accent hover:bg-accent-pressed disabled:cursor-not-allowed disabled:opacity-50">
        {submitLabel}
        <ArrowRight size={20} weight="bold" />
      </button>
    </form>
  );
}

function availabilityMessage(status: Availability) {
  if (status === "available") return "Disponible";
  if (status === "checking") return "Comprobando disponibilidad…";
  if (status === "taken") return "Este username ya está ocupado.";
  if (status === "reserved") return "Este username está reservado.";
  if (status === "invalid") return "Usa entre 3 y 30 letras, números o guion bajo.";
  if (status === "error") return "No pudimos comprobarlo. Intenta nuevamente.";
  return "Usa entre 3 y 30 letras, números o guion bajo.";
}
