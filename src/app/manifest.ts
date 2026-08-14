import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TipMe",
    short_name: "TipMe",
    description: "Recibe tips y entérate al instante.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f4",
    theme_color: "#d95747",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

