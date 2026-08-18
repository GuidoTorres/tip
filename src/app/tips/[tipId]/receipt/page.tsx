import { notFound } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env/server";
import { verifyReceiptToken } from "@/lib/security/receipt";
import { ReceiptStatus } from "@/components/tips/receipt-status";
import type { Currency, TipStatus } from "@/features/payments/types";

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ tipId: string }>; searchParams: Promise<{ token?: string }> }) {
  const { tipId } = await params; const { token = "" } = await searchParams;
  if (!verifyReceiptToken(tipId, token, getServerEnv().RECEIPT_SIGNING_SECRET)) notFound();
  const { data } = await createAdminSupabaseClient().from("tips").select("id,status,amount_minor,currency,message,profiles!tips_creator_id_fkey(public_name,username)").eq("id", tipId).single();
  if (!data) notFound();
  const receipt = data as unknown as { id: string; status: TipStatus; amount_minor: number; currency: Currency; message: string | null; profiles: { public_name: string | null; username: string } | null };
  return <main className="grid min-h-[100dvh] place-items-center px-4 py-10"><section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)] sm:p-8"><ReceiptStatus initial={receipt} token={token} /></section></main>;
}
