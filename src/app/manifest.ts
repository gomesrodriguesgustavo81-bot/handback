import type { MetadataRoute } from "next";

/** Deixa adicionar o Handback à tela de início (e receber notificações no iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Handback",
    short_name: "Handback",
    description: "Você recebe, a gente devolve conferido.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7f5",
    theme_color: "#0e3b37",
    lang: "pt-BR",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
