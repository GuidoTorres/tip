import { ImageResponse } from "next/og";

export type ReceiptImageData = {
  creatorName: string;
  amount: string;
  localAmount?: string | null;
  operationCode: string;
  message: string | null;
};

export function createReceiptImage(data: ReceiptImageData) {
  const message = data.message?.trim().slice(0, 140) || null;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f7f7f4", padding: 72, color: "#222321" }}>
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#ffffff", borderRadius: 20, padding: "64px 72px", border: "2px solid #dfe1dc" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 42, fontWeight: 800 }}>TipMe<span style={{ color: "#d95747" }}>.</span></div>
          <div style={{ display: "flex", alignItems: "center", borderRadius: 999, backgroundColor: "#e5f3ed", color: "#24745a", padding: "12px 22px", fontSize: 22, fontWeight: 700 }}>Confirmado</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80, textAlign: "center" }}>
          <div style={{ width: 108, height: 108, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "#24745a", color: "white", fontSize: 38, fontWeight: 800 }}>OK</div>
          <div style={{ display: "flex", marginTop: 32, fontSize: 40, fontWeight: 750 }}>Tip enviado</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 27, color: "#666963" }}>Le enviaste a {data.creatorName}</div>
          <div style={{ display: "flex", marginTop: 46, fontSize: 86, fontWeight: 800, letterSpacing: "-3px" }}>{data.amount}</div>
          {data.localAmount && <div style={{ display: "flex", marginTop: 12, fontSize: 21, color: "#666963" }}>Procesado como {data.localAmount}</div>}
          {message && <div style={{ display: "flex", maxWidth: 700, marginTop: 42, padding: "24px 32px", borderRadius: 16, backgroundColor: "#eeefeb", color: "#4f524d", fontSize: 25, lineHeight: 1.4, textAlign: "center" }}>“{message}”</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "auto", borderTop: "2px solid #dfe1dc", paddingTop: 40 }}>
          <div style={{ display: "flex", fontSize: 20, color: "#666963", fontWeight: 650 }}>Código de operación</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 32, fontWeight: 800, letterSpacing: "2px" }}>{data.operationCode}</div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 20, color: "#666963", textAlign: "center" }}>Verifica este código en el historial de TipMe. Una imagen por sí sola no confirma el pago.</div>
        </div>
      </div>
    </div>,
    {
      width: 1080,
      height: 1350,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="tipme-${data.operationCode}.png"`,
      },
    },
  );
}
