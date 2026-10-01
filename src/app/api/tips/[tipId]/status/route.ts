import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { verifyReceiptToken } from "@/lib/security/receipt";

export async function GET(request: Request, { params }: { params: Promise<{ tipId: string }> }) {
  const { tipId } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!verifyReceiptToken(tipId, token, getServerEnv().RECEIPT_SIGNING_SECRET)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data } = await createAdminSupabaseClient().from("tips").select("id,status,operation_code,base_amount_minor,processing_support_minor,amount_minor,currency,provider,message,profiles!tips_creator_id_fkey(public_name,username)").eq("id", tipId).single();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}
