import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "聊聊机 - Chat-O-Matic",
    short_name: "聊聊机",
    description: "专为青少年设计的 AI 聊天伙伴",
    start_url: "/",
    display: "standalone",
    background_color: "#f0f0f0",
    theme_color: "#fde047",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
