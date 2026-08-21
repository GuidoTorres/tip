import { describe, expect, it, vi } from "vitest";
import { SupabaseMercadoPagoCredentialRepository } from "@/features/payments/mercadopago-credential-repository";

const key = Buffer.alloc(32, 9).toString("base64");

describe("SupabaseMercadoPagoCredentialRepository", () => {
  it("encrypts tokens before persisting them", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert }) };
    const repository = new SupabaseMercadoPagoCredentialRepository(client as never, key);

    await repository.upsert({ accountId: "account-1", accessToken: "access-secret", refreshToken: "refresh-secret", expiresAt: "2026-08-21T00:00:00.000Z", scopes: ["offline_access"] });

    const row = upsert.mock.calls[0][0];
    expect(row.access_token_ciphertext).not.toContain("access-secret");
    expect(row.refresh_token_ciphertext).not.toContain("refresh-secret");
    expect(row).toMatchObject({ payment_account_id: "account-1", scopes: ["offline_access"] });
  });

  it("decrypts credentials only when loaded server-side", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn();
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const client = { from: vi.fn().mockReturnValue({ upsert, select }) };
    const repository = new SupabaseMercadoPagoCredentialRepository(client as never, key);
    await repository.upsert({ accountId: "account-1", accessToken: "access-secret", refreshToken: null, expiresAt: null, scopes: [] });
    maybeSingle.mockResolvedValue({ data: upsert.mock.calls[0][0], error: null });

    await expect(repository.findByAccountId("account-1")).resolves.toMatchObject({ accessToken: "access-secret", refreshToken: null });
  });
});
