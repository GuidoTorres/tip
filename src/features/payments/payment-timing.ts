export const paymentTimingLabels = {
  checkout_bootstrap: "Preparar checkout",
  paypal_sdk_load: "Cargar SDK de PayPal",
  paypal_sdk_initialize: "Inicializar SDK",
  payment_method_eligibility: "Comprobar métodos",
  order_create: "Crear orden",
  paypal_interaction: "Interacción en PayPal",
  card_authorization: "Autorizar tarjeta",
  capture: "Capturar pago",
  webhook_confirmation: "Confirmar webhook",
} as const;

export type PaymentTimingStage = keyof typeof paymentTimingLabels;
export type PaymentTimingStatus = "pending" | "completed" | "failed" | "canceled" | "timeout";

export type PaymentTimingEntry = {
  stage: PaymentTimingStage;
  status: PaymentTimingStatus;
  durationMs: number | null;
};

export const PAYMENT_TIMING_STORAGE_KEY = "tipme:paypal-payment-diagnostics";

const paymentTimingStatuses = new Set<PaymentTimingStatus>(["pending", "completed", "failed", "canceled", "timeout"]);

export function paymentTimingDebugEnabled(search: string) {
  return new URLSearchParams(search).get("debugPayments") === "1";
}

export function paymentTimingReceiptHref(receiptHref: string, diagnosticsEnabled: boolean) {
  if (!diagnosticsEnabled) return receiptHref;
  return `${receiptHref}${receiptHref.includes("?") ? "&" : "?"}debugPayments=1`;
}

export function parseStoredPaymentTimings(value: string | null): PaymentTimingEntry[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((candidate): PaymentTimingEntry[] => {
      if (!candidate || typeof candidate !== "object") return [];
      const entry = candidate as Record<string, unknown>;
      if (typeof entry.stage !== "string" || !(entry.stage in paymentTimingLabels)) return [];
      if (typeof entry.status !== "string" || !paymentTimingStatuses.has(entry.status as PaymentTimingStatus)) return [];
      if (entry.durationMs !== null && (typeof entry.durationMs !== "number" || !Number.isFinite(entry.durationMs) || entry.durationMs < 0)) return [];
      return [{
        stage: entry.stage as PaymentTimingStage,
        status: entry.status as PaymentTimingStatus,
        durationMs: entry.durationMs as number | null,
      }];
    });
  } catch {
    return [];
  }
}

type RecorderOptions = {
  enabled: boolean;
  now?: () => number;
  onChange?: (entries: PaymentTimingEntry[]) => void;
  initialEntries?: PaymentTimingEntry[];
};

function normalizedDuration(durationMs: number) {
  return Math.max(0, Math.round(durationMs));
}

export function createPaymentTimingRecorder({ enabled, now = () => performance.now(), onChange, initialEntries = [] }: RecorderOptions) {
  let values: PaymentTimingEntry[] = enabled ? initialEntries.map((entry) => ({ ...entry })) : [];

  function publish(entry: PaymentTimingEntry) {
    const index = values.findIndex((candidate) => candidate.stage === entry.stage);
    values = index === -1
      ? [...values, entry]
      : values.map((candidate, candidateIndex) => candidateIndex === index ? entry : candidate);
    onChange?.(values.map((candidate) => ({ ...candidate })));
  }

  function start(stage: PaymentTimingStage) {
    if (!enabled) return (status: PaymentTimingStatus = "completed") => { void status; };
    const startedAt = now();
    let finished = false;
    publish({ stage, status: "pending", durationMs: null });
    return (status: PaymentTimingStatus = "completed") => {
      if (finished) return;
      finished = true;
      publish({ stage, status, durationMs: normalizedDuration(now() - startedAt) });
    };
  }

  function record(stage: PaymentTimingStage, durationMs: number, status: PaymentTimingStatus = "completed") {
    if (!enabled) return;
    publish({ stage, status, durationMs: normalizedDuration(durationMs) });
  }

  async function measure<T>(stage: PaymentTimingStage, operation: () => Promise<T>) {
    const finish = start(stage);
    try {
      const result = await operation();
      finish("completed");
      return result;
    } catch (error) {
      finish("failed");
      throw error;
    }
  }

  return {
    start,
    record,
    measure,
    entries: () => values.map((entry) => ({ ...entry })),
  };
}
