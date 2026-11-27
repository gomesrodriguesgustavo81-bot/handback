import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AvisoCookies } from "@/components/aviso-cookies";
import "./globals.css";

// Letra da marca: Plus Jakarta Sans (arredondada e fácil de ler) nos títulos e no texto.
const texto = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--fonte-texto", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Handback", template: "%s · Handback" },
  description: "Você recebe, a gente devolve conferido. Entregas conferidas com IA e aprovadas por pessoas.",
  // Código do Google Search Console (comprova que o site é nosso). Não é segredo.
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

const TEMA = `try{var m=document.cookie.match(/(?:^|; )hb_tema=(claro|escuro)/);if(m)document.documentElement.dataset.tema=m[1]}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`h-full antialiased ${texto.variable}`}>
      <head>
        {/* Aplica o tema escolhido (claro/escuro) antes de desenhar a tela, para não piscar. */}
        <script dangerouslySetInnerHTML={{ __html: TEMA }} />
      </head>
      <body className="flex min-h-full flex-col">{children}
        <AvisoCookies />
      </body>
    </html>
  );
}
