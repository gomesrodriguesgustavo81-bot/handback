import type { NextConfig } from "next";

const EM_PRODUCAO = process.env.NODE_ENV === "production";

/**
 * Política de conteúdo: o navegador só carrega scripts, imagens, conexões e
 * quadros dos endereços listados aqui. Os scripts "inline" do próprio Next
 * ainda são aceitos (travar isso exige um código novo por visita, o que
 * tiraria as páginas públicas do cache); o que fica barrado é carregar script
 * de qualquer outro site, plugins e enviar dados para endereços de fora.
 */
const CSP = [
  "default-src 'self'",
  // Google Picker (escolher arquivos do Classroom) carrega o script de apis.google.com.
  `script-src 'self' 'unsafe-inline'${EM_PRODUCAO ? "" : " 'unsafe-eval'"} https://apis.google.com https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://apis.google.com https://www.googleapis.com",
  "frame-src https://docs.google.com https://drive.google.com https://accounts.google.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://*.supabase.co",
].join("; ");

/** Cabeçalhos de segurança em todas as páginas. */
const SEGURANCA = [
  // Só HTTPS (o navegador lembra por 2 anos).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Nenhum outro site pode mostrar o Handback dentro dele (evita golpes de clique).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Plano de ensino enviado para a IA (até 4 MB; a Vercel aceita até 4,5 MB por pedido).
  experimental: { serverActions: { bodySizeLimit: "4.4mb" } },
  async headers() {
    return [
      { source: "/:caminho*", headers: SEGURANCA },
      // Arquivos das entregas (enviados por alunos): abrem isolados, sem poder rodar nada no site.
      {
        source: "/app/:slug/entregas/:id/arquivo/:arquivo",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
