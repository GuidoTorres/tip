type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function logSupabaseError<TError extends SupabaseErrorLike>(
  context: string,
  error: TError,
  userId?: string,
) {
  console.error("[TipMe] Supabase operation failed", {
    context,
    userId,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}
