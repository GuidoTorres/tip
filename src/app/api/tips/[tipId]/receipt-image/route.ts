import { createReceiptImage } from "@/features/payments/receipt-image";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { formatMoney } from "@/lib/i18n";
import { verifyReceiptToken } from "@/lib/security/receipt";

export async function GET(request: Request, { params }: { params: Promise<{ tipId: string }> }) {
  const { tipId } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!verifyReceiptToken(tipId, token, getServerEnv().RECEIPT_SIGNING_SECRET)) return new Response("Not found", { status: 404 });

  const { data } = await createAdminSupabaseClient().from("tips")
    .select("id,status,operation_code,base_amount_minor,amount_minor,currency,message,profiles!tips_creator_id_fkey(public_name,username)")
    .eq("id", tipId)
    .single();
  if (!data || data.status !== "confirmed") return new Response("Not found", { status: 404 });

  const profile = data.profiles as unknown as { public_name: string | null; username: string } | null;
  const creatorName = profile?.public_name ?? profile?.username ?? "este perfil";
  const baseAmountMinor = Number(data.base_amount_minor ?? data.amount_minor);
  return createReceiptImage({
    creatorName,
    amount: formatMoney(baseAmountMinor, String(data.currency), "es"),
    operationCode: String(data.operation_code),
    message: data.message,
  });
}
