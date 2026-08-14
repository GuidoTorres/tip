import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabasePayoutRepository } from "@/features/payouts/supabase-repository";
import { processPayoutEvent } from "@/features/payouts/service";
import { sendPayoutPush } from "@/features/notifications/web-push";
import { mockSimulatorAllowed } from "@/lib/env/runtime";

const schema = z.object({ status: z.enum(["processing", "completed", "failed"]) });

export async function POST(request: Request, { params }: { params: Promise<{ payoutId: string }> }) {
  if (!mockSimulatorAllowed(process.env)) return new NextResponse(null, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_simulation" }, { status: 400 });
  const { payoutId } = await params;
  const userClient = await createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: payout } = await userClient.from("payouts").select("id,provider,provider_payout_id,status").eq("id", payoutId).eq("creator_id", user.id).single();
  if (!payout?.provider_payout_id || payout.provider !== "mock") return NextResponse.json({ error: "payout_not_found" }, { status: 404 });
  const admin = createAdminSupabaseClient();
  const eventId = `mock_po_evt_${crypto.randomUUID()}`;
  const raw = JSON.stringify({ eventId, payoutId, providerPayoutId: payout.provider_payout_id, status: parsed.data.status });
  const result = await processPayoutEvent({ provider: "mock", eventId, providerPayoutId: payout.provider_payout_id, status: parsed.data.status, payloadDigest: createHash("sha256").update(raw).digest("hex"), failureCode: parsed.data.status === "failed" ? "mock_failure" : null }, {
    repository: new SupabasePayoutRepository(admin, admin),
    notify: (payload) => sendPayoutPush(admin, payload),
  });
  return NextResponse.json({ ok: true, result });
}
