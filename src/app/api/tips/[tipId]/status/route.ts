import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { verifyReceiptToken } from "@/lib/security/receipt";

export async function GET(request: Request, { params }: { params: Promise<{ tipId: string }> }) {
  const { tipId } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!verifyReceiptToken(tipId, token, getServerEnv().MOCK_WEBHOOK_SECRET)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data } = await createAdminSupabaseClient().from("tips").select("id,status,amount_minor,currency,message,profiles!tips_creator_id_fkey(public_name,username)").eq("id", tipId).single();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}

