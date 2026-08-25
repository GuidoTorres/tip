"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useState } from "react";

export function PasswordField({ mode }: { mode: "login" | "signup" }) {
  const [visible, setVisible] = useState(false);
  const signup = mode === "signup";

  return (
    <div>
      <label htmlFor="password" className="block text-sm font-semibold">
        Contraseña
        <div className="relative mt-2">
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={8}
            required
            aria-describedby={signup ? "password-hint" : undefined}
            className="min-h-12 w-full rounded-xl border border-border bg-background py-2 pl-4 pr-14 outline-none focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/40"
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
            className="pressable absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted hover:text-foreground"
          >
            {visible ? <EyeSlash size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </label>
      {signup && (
        <p id="password-hint" className="mt-2 text-xs text-muted">
          Mínimo 8 caracteres.
        </p>
      )}
    </div>
  );
}
