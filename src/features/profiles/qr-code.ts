import QRCode from "qrcode";

export function generatePublicProfileQr(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    type: "image/png",
    width: 768,
    margin: 4,
    errorCorrectionLevel: "M",
    color: {
      dark: "#222321",
      light: "#ffffff",
    },
  });
}
