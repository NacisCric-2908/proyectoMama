import type { BaseCIF as BaseCIFDB, ParametroCIF } from "@prisma/client";
import { z } from "zod";
import { BASES_CIF, d, tasaPredeterminada, type BaseCIF } from "@/lib/costeo";
import { exigir, type UsuarioActual } from "@/lib/auth/permisos";
import { auditar } from "./auditoria";
import { aISO, ErrorNegocio, periodoDe, type Tx } from "./util";

/** N.º de proyectos del período: órdenes no anuladas terminadas en el mes. */
export async function proyectosTerminadosEnPeriodo(tx: Tx, periodo: string): Promise<number> {
  const [a, m] = periodo.split("-").map(Number);
  const desde = new Date(Date.UTC(a, m - 1, 1));
  const hasta = new Date(Date.UTC(a, m, 1));
  return tx.ordenProyecto.count({
    where: { eliminadoEn: null, estado: { not: "ANULADO" }, fechaTerminacion: { gte: desde, lt: hasta } },
  });
}

/**
 * Tasa vigente de un parámetro de CIF:
 * tasa directa si se ingresó; si no, tasa predeterminada = CIF presupuestado ÷ base estimada.
 * Para "Número de proyectos": CIF del período ÷ proyectos terminados en el mes
 * (o la base estimada configurada si aún no hay terminados).
 */
export async function tasaDelParametro(tx: Tx, p: ParametroCIF): Promise<{ tasa: string; detalle: string }> {
  if (p.tasaDirecta !== null) return { tasa: p.tasaDirecta.toString(), detalle: "Tasa ingresada directamente" };
  if (p.cifPresupuestado === null) throw new ErrorNegocio(`El período ${p.periodo} no tiene tasa ni CIF presupuestado`);
  if (p.base === "NUMERO_PROYECTOS") {
    const terminados = await proyectosTerminadosEnPeriodo(tx, p.periodo);
    const n = terminados > 0 ? terminados : Number(p.baseEstimada ?? 0);
    return {
      tasa: tasaPredeterminada(p.base, p.cifPresupuestado.toString(), n).toString(),
      detalle: terminados > 0 ? `CIF del período ÷ ${terminados} proyectos terminados` : `CIF del período ÷ ${n} proyectos estimados`,
    };
  }
  return {
    tasa: tasaPredeterminada(p.base, p.cifPresupuestado.toString(), p.baseEstimada?.toString() ?? 0).toString(),
    detalle: "Tasa predeterminada = CIF presupuestado ÷ base total estimada",
  };
}

async function periodoDeOrden(tx: Tx, ordenId: string) {
  const o = await tx.ordenProyecto.findUniqueOrThrow({ where: { id: ordenId } });
  return { orden: o, periodo: periodoDe(aISO(o.fechaCreacion)!) };
}

/** Asigna el CIF del período a la orden con la base del período. No falla si no hay parámetros. */
export async function asignarCIFAutomatico(tx: Tx, u: UsuarioActual | null, ordenId: string) {
  const { periodo } = await periodoDeOrden(tx, ordenId);
  const p = await tx.parametroCIF.findUnique({ where: { periodo } });
  if (!p) return null;
  try {
    const { tasa } = await tasaDelParametro(tx, p);
    return await guardarAsignacion(tx, u, ordenId, periodo, p.base, tasa, null);
  } catch {
    return null;
  }
}

async function guardarAsignacion(
  tx: Tx,
  u: UsuarioActual | null,
  ordenId: string,
  periodo: string,
  base: BaseCIFDB,
  tasa: string,
  justificacion: string | null,
) {
  const antes = await tx.asignacionCIF.findUnique({ where: { ordenId } });
  const datos = {
    periodo,
    base,
    tasaAplicada: tasa,
    // valores informativos; se actualizan al cerrar con el cálculo final
    cantidadBase: antes?.cantidadBase ?? "0",
    valorAsignado: antes?.valorAsignado ?? "0",
    justificacionCambioBase: justificacion,
    usuarioId: u?.id ?? null,
    fecha: new Date(),
  };
  const asignacion = await tx.asignacionCIF.upsert({ where: { ordenId }, create: { ordenId, ...datos }, update: datos });
  await auditar(tx, u, "AsignacionCIF", ordenId, antes, asignacion, ["base", "tasaAplicada", "periodo", "justificacionCambioBase"]);
  return asignacion;
}

export const esquemaAsignacion = z.object({
  base: z.enum(["HORAS_MOD", "HORAS_TOTALES", "COSTO_MOD", "COSTO_DIRECTO", "NUMERO_PROYECTOS"]).optional(),
  tasa: z.string().trim().optional().transform((v) => (v ? v.replace(",", ".") : undefined)),
  justificacion: z.string().trim().optional(),
});

/**
 * Asigna o recalcula el CIF de una orden abierta.
 * Sin base o con la base del período → toma la tasa del período ("Recalcular CIF").
 * Con otra base → exige tasa y justificación.
 */
export async function asignarCIF(tx: Tx, u: UsuarioActual, ordenId: string, entrada: z.input<typeof esquemaAsignacion> = {}) {
  exigir(u, "cif.asignar");
  const e = esquemaAsignacion.parse(entrada);
  const { orden, periodo } = await periodoDeOrden(tx, ordenId);
  if (["TERMINADO", "FACTURADO", "ANULADO"].includes(orden.estado))
    throw new ErrorNegocio("La orden está cerrada o anulada y no se puede modificar");
  const p = await tx.parametroCIF.findUnique({ where: { periodo } });

  const base = e.base ?? p?.base;
  if (!base) throw new ErrorNegocio(`No hay parámetros de CIF configurados para el período ${periodo}`);

  if (p && base === p.base && !e.tasa) {
    const { tasa } = await tasaDelParametro(tx, p);
    return guardarAsignacion(tx, u, ordenId, periodo, base, tasa, null);
  }
  if (!e.tasa || !/^\d+(\.\d+)?$/.test(e.tasa)) throw new ErrorNegocio("Debe indicar una tasa válida para la base elegida");
  if (!e.justificacion) throw new ErrorNegocio("Debe justificar el cambio de base o de tasa de CIF en esta orden");
  return guardarAsignacion(tx, u, ordenId, periodo, base, e.tasa, e.justificacion);
}

/** Estado del CIF de una orden: parámetro del período y si la tasa guardada quedó desactualizada. */
export async function estadoCIF(tx: Tx, ordenId: string) {
  const { periodo } = await periodoDeOrden(tx, ordenId);
  const [p, asignacion] = await Promise.all([
    tx.parametroCIF.findUnique({ where: { periodo } }),
    tx.asignacionCIF.findUnique({ where: { ordenId } }),
  ]);
  let tasaPeriodo: string | null = null;
  let detalle: string | null = null;
  let error: string | null = null;
  if (p) {
    try {
      ({ tasa: tasaPeriodo, detalle } = await tasaDelParametro(tx, p));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  const desactualizado =
    !!p && !!asignacion && tasaPeriodo !== null && asignacion.base === p.base && !d(asignacion.tasaAplicada.toString()).equals(d(tasaPeriodo));
  return {
    periodo,
    parametro: p ? { base: p.base as BaseCIF, nombreBase: BASES_CIF[p.base as BaseCIF].nombre, tasa: tasaPeriodo, detalle } : null,
    error,
    desactualizado,
  };
}

// ───────────── Parámetros por período ─────────────

export const esquemaParametroCIF = z
  .object({
    periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Período inválido (aaaa-mm)"),
    base: z.enum(["HORAS_MOD", "HORAS_TOTALES", "COSTO_MOD", "COSTO_DIRECTO", "NUMERO_PROYECTOS"]),
    tasaDirecta: z.string().trim().optional().nullable().transform((v) => (v ? v.replace(",", ".") : null)),
    cifPresupuestado: z.string().trim().optional().nullable().transform((v) => (v ? v.replace(",", ".") : null)),
    baseEstimada: z.string().trim().optional().nullable().transform((v) => (v ? v.replace(",", ".") : null)),
    observaciones: z.string().optional().nullable(),
  })
  .refine((p) => p.tasaDirecta !== null || (p.cifPresupuestado !== null && p.baseEstimada !== null), {
    message: "Ingrese la tasa directamente o el CIF presupuestado y la base estimada",
  })
  .refine((p) => [p.tasaDirecta, p.cifPresupuestado, p.baseEstimada].every((v) => v === null || /^\d+(\.\d+)?$/.test(v)), {
    message: "Los valores deben ser números no negativos",
  });

export async function guardarParametroCIF(tx: Tx, u: UsuarioActual, entrada: z.input<typeof esquemaParametroCIF>) {
  exigir(u, "cif.configurar");
  const r = esquemaParametroCIF.safeParse(entrada);
  if (!r.success) throw new ErrorNegocio(r.error.issues[0].message);
  const datos = r.data;
  if (datos.tasaDirecta === null && datos.base !== "NUMERO_PROYECTOS" && Number(datos.baseEstimada) <= 0)
    throw new ErrorNegocio("La base total estimada del período debe ser mayor que cero");
  const antes = await tx.parametroCIF.findUnique({ where: { periodo: datos.periodo } });
  const p = await tx.parametroCIF.upsert({ where: { periodo: datos.periodo }, create: datos, update: datos });
  await auditar(tx, u, "ParametroCIF", p.id, antes, p, ["base", "tasaDirecta", "cifPresupuestado", "baseEstimada"]);
  return p;
}

