import { obtenerUsuario, tiene } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { d, type FilaRentabilidad } from "@/lib/costeo";
import { reporteRentabilidad } from "@/lib/servicios/reportes";

export const runtime = "nodejs";

/** CSV para Excel en configuración regional colombiana: separador «;», coma decimal y BOM UTF-8. */
const num = (v: { toString(): string } | null) => (v === null ? "" : d(v.toString()).toDecimalPlaces(2).toString().replace(".", ","));
const txt = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const u = await obtenerUsuario();
  if (!u) return new Response("Sesión expirada", { status: 401 });
  if (!tiene(u, "margenes.ver")) return new Response("No tiene permiso", { status: 403 });
  const url = new URL(req.url);
  const r = await reporteRentabilidad(prisma, u, { desde: url.searchParams.get("desde") ?? undefined, hasta: url.searchParams.get("hasta") ?? undefined });

  const fila = (f: FilaRentabilidad) =>
    [txt(f.cliente), f.ordenes, num(f.cotizado), num(f.costo), num(f.margen), num(f.margenPct), num(f.costoAjustado), num(f.margenAjustado), num(f.margenAjustadoPct)].join(";");
  const lineas = [
    "Rentabilidad por cliente",
    ["Cliente", "Órdenes", "Cotizado", "Costo acumulado", "Margen", "Margen %", "Costo ajustado", "Margen ajustado", "Margen ajustado %"].join(";"),
    ...r.filas.map(fila),
    fila(r.total),
    "",
    "Rentabilidad por proyecto",
    ["Orden", "Cliente", "Fecha de terminación", "Cotizado", "Costo acumulado", "Margen %", "Costo ajustado"].join(";"),
    ...r.proyectos.map((p) =>
      [txt(p.codigo), txt(p.cliente), p.fechaTerminacion ?? "", num(p.valorCotizado), num(p.costoTotal), num(p.margenPct), num(p.costoAjustado)].join(";"),
    ),
  ];
  return new Response("﻿" + lineas.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="rentabilidad.csv"' },
  });
}
