import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  // pdfkit carga sus fuentes estándar con require dinámico: el rastreo de archivos
  // no las detecta y faltarían en la función serverless de Vercel.
  outputFileTracingIncludes: {
    "/api/ordenes/[id]/pdf": ["./node_modules/pdfkit/js/standard-fonts/**/*", "./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
