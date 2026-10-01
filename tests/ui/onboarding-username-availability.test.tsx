import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OnboardingProfileForm } from "@/components/onboarding/onboarding-profile-form";

describe("onboarding username availability", () => {
  it("blocks a new profile until its username is validated", () => {
    const html = renderToStaticMarkup(
      <OnboardingProfileForm action={async () => {}} publicName="" username="" bio="" socialUrl="" locale="es" showCurrency submitLabel="Continuar" />,
    );

    expect(html).toContain('name="username"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toMatch(/<button[^>]*disabled=""/);
  });

  it("allows a creator to keep an already saved username", () => {
    const html = renderToStaticMarkup(
      <OnboardingProfileForm action={async () => {}} publicName="Camila" username="camila" bio="Hola" socialUrl="https://www.tiktok.com/@camila" locale="es" showCurrency submitLabel="Continuar" />,
    );

    expect(html).toContain('value="camila"');
    expect(html).not.toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain('Disponible');
  });
});
