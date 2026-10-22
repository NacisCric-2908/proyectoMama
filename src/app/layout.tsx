import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Costeo de proyectos",
  description: "Sistema de costeo por órdenes de proyecto para tableros eléctricos",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
