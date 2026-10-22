import type { BaseCIF as BaseCIFDB, ParametroCIF, Prisma, TasaActividadCIF } from "@prisma/client";
import { z } from "zod";
import { ACTIVIDADES_CIF, BASES_CIF, d, ErrorCosteo, tasaPredeterminada, type ActividadCIF, type BaseCIF, type TasaActividad } from "@/lib/costeo";
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
type ParametroConTasas = ParametroCIF & { tasasActividad: TasaActividadCIF[] };
const conTasas = { include: { tasasActividad: true } } as const;

export interface TasaPeriodo {
  tasa: string;
  detalle: string;
  /** Solo para la base ACTIVIDADES. */
  tasasActividad: TasaActividad[] | null;
}

/** Tasas de cada actividad: directa o predeterminada (CIF presupuestado ÷ inductor estimado). */
function tasasDeActividades(p: ParametroConTasas): TasaActividad[] {
  if (!p.tasasActividad.length) throw new ErrorNegocio(`El período ${p.periodo} no tiene tasas por actividad configuradas`);
  return p.tasasActividad
    .sort((a, b) => Object.keys(ACTIVIDADES_CIF).indexOf(a.actividad) - Object.keys(ACTIVIDADES_CIF).indexOf(b.actividad))
    .map((t) => {
      if (t.tasaDirecta !== null) return { actividad: t.actividad as ActividadCIF, tasa: t.tasaDirecta.toString() };
      try {
        return {
          actividad: t.actividad as ActividadCIF,
          tasa: tasaPredeterminada(t.actividad as ActividadCIF, t.cifPresupuestado?.toString() ?? 0, t.baseEstimada?.toString() ?? 0).toString(),
        };
      } catch (e) {
        if (e instanceof ErrorCosteo) throw new ErrorNegocio(`${ACTIVIDADES_CIF[t.actividad as ActividadCIF].nombre}: ${e.message}`);
        throw e;
      }
    });
}

export async function tasaDelParametro(tx: Tx, p: ParametroConTasas): Promise<TasaPeriodo> {
  if (p.base === "ACTIVIDADES")
    return { tasa: "0", detalle: "Tasas predeterminadas por actividad", tasasActividad: tasasDeActividades(p) };
  return { ...(await tasaUnica(tx, p)), tasasActividad: null };
}

async function tasaUnica(tx: Tx, p: ParametroCIF): Promise<{ tasa: string; detalle: string }> {
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
  const p = await tx.parametroCIF.findUnique({ where: { periodo }, ...conTasas });
  if (!p) return null;
  try {
    const { tasa, tasasActividad } = await tasaDelParametro(tx, p);
    return await guardarAsignacion(tx, u, ordenId, periodo, p.base, tasa, null, tasasActividad);
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
  tasasActividad: TasaActividad[] | null = null,
) {
  const antes = await tx.asignacionCIF.findUnique({ where: { ordenId } });
  const datos = {
    periodo,
    base,
    tasaAplicada: tasa,
    tasasActividad: (tasasActividad ?? undefined) as Prisma.InputJsonValue | undefined,
    // valores informativos; se actualizan al cerrar con el cálculo final
    cantidadBase: antes?.cantidadBase ?? "0",
    valorAsignado: antes?.valorAsignado ?? "0",
    justificacionCambioBase: justificacion,
    usuarioId: u?.id ?? null,
    fecha: new Date(),
  };
  const asignacion = await tx.asignacionCIF.upsert({ where: { ordenId }, create: { ordenId, ...datos }, update: datos });
  await auditar(tx, u, "AsignacionCIF", ordenId, antes, asignacion, ["base", "tasaAplicada", "tasasActividad", "periodo", "justificacionCambioBase"]);
  return asignacion;
}

export const esquemaAsignacion = z.object({
  base: z.enum(["HORAS_MOD", "HORAS_TOTALES", "COSTO_MOD", "COSTO_DIRECTO", "NUMERO_PROYECTOS", "ACTIVIDADES"]).optional(),
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
  const r = esquemaAsignacion.safeParse(entrada);
  if (!r.success) throw new ErrorNegocio(r.error.issues[0].message);
  const e = r.data;
  const { orden, periodo } = await periodoDeOrden(tx, ordenId);
  if (["TERMINADO", "FACTURADO", "ANULADO"].includes(orden.estado))
    throw new ErrorNegocio("La orden está cerrada o anulada y no se puede modificar");
  const p = await tx.parametroCIF.findUnique({ where: { periodo }, ...conTasas });

  const base = e.base ?? p?.base;
  if (!base) throw new ErrorNegocio(`No hay parámetros de CIF configurados para el período ${periodo}`);

  if (p && base === p.base && !e.tasa) {
    const { tasa, tasasActividad } = await tasaDelParametro(tx, p);
    return guardarAsignacion(tx, u, ordenId, periodo, base, tasa, null, tasasActividad);
  }
  if (base === "ACTIVIDADES")
    throw new ErrorNegocio("Las tasas por actividad se toman de los parámetros del período; configure el período con esa base");
  if (!e.tasa || !/^\d+(\.\d+)?$/.test(e.tasa)) throw new ErrorNegocio("Debe indicar una tasa válida para la base elegida");
  if (!e.justificacion) throw new ErrorNegocio("Debe justificar el cambio de base o de tasa de CIF en esta orden");
  return guardarAsignacion(tx, u, ordenId, periodo, base, e.tasa, e.justificacion);
}

/** Estado del CIF de una orden: parámetro del período y si la tasa guardada quedó desactualizada. */
export async function estadoCIF(tx: Tx, ordenId: string) {
  const { periodo } = await periodoDeOrden(tx, ordenId);
  const [p, asignacion] = await Promise.all([
    tx.parametroCIF.findUnique({ where: { periodo }, ...conTasas }),
    tx.asignacionCIF.findUnique({ where: { ordenId } }),
  ]);
  let tasaPeriodo: string | null = null;
  let tasasPeriodo: TasaActividad[] | null = null;
  let detalle: string | null = null;
  let error: string | null = null;
  if (p) {
    try {
      ({ tasa: tasaPeriodo, detalle, tasasActividad: tasasPeriodo } = await tasaDelParametro(tx, p));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  const mismasTasas = (a: TasaActividad[] | null, b: TasaActividad[] | null) =>
    JSON.stringify((a ?? []).map((t) => [t.actividad, d(t.tasa).toString()])) === JSON.stringify((b ?? []).map((t) => [t.actividad, d(t.tasa).toString()]));
  const desactualizado =
    !!p &&
    !!asignacion &&
    tasaPeriodo !== null &&
    asignacion.base === p.base &&
    (!d(asignacion.tasaAplicada.toString()).equals(d(tasaPeriodo)) ||
      !mismasTasas(asignacion.tasasActividad as unknown as TasaActividad[] | null, tasasPeriodo));
  return {
    periodo,
    parametro: p
      ? { base: p.base as BaseCIF, nombreBase: BASES_CIF[p.base as BaseCIF].nombre, tasa: tasaPeriodo, detalle, tasasActividad: tasasPeriodo }
      : null,
    error,
    desactualizado,
  };
}

// ───────────── Parámetros por período ─────────────

const decimalOpcional = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v.replace(",", ".") : null))
  .refine((v) => v === null || /^\d+(\.\d+)?$/.test(v), "Los valores deben ser números no negativos");

export const esquemaParametroCIF = z
  .object({
    periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Período inválido (aaaa-mm)"),
    base: z.enum(["HORAS_MOD", "HORAS_TOTALES", "COSTO_MOD", "COSTO_DIRECTO", "NUMERO_PROYECTOS", "ACTIVIDADES"]),
    tasaDirecta: decimalOpcional,
    cifPresupuestado: decimalOpcional,
    baseEstimada: decimalOpcional,
    observaciones: z.string().optional().nullable(),
  })
  .refine((p) => p.base === "ACTIVIDADES" || p.tasaDirecta !== null || (p.cifPresupuestado !== null && p.baseEstimada !== null), {
    message: "Ingrese la tasa directamente o el CIF presupuestado y la base estimada",
  });

const esquemaTasaActividad = z.object({
  tasaDirecta: decimalOpcional,
  cifPresupuestado: decimalOpcional,
  baseEstimada: decimalOpcional,
});

/** Lee las tasas por actividad del formulario: campos act_<ACTIVIDAD>_<campo>. */
function tasasDelFormulario(entrada: Record<string, unknown>) {
  return (Object.keys(ACTIVIDADES_CIF) as ActividadCIF[]).flatMap((actividad) => {
    const r = esquemaTasaActividad.safeParse({
      tasaDirecta: entrada[`act_${actividad}_tasaDirecta`],
      cifPresupuestado: entrada[`act_${actividad}_cifPresupuestado`],
      baseEstimada: entrada[`act_${actividad}_baseEstimada`],
    });
    if (!r.success) throw new ErrorNegocio(`${ACTIVIDADES_CIF[actividad].nombre}: ${r.error.issues[0].message}`);
    const t = r.data;
    if (t.tasaDirecta === null && t.cifPresupuestado === null && t.baseEstimada === null) return [];
    if (t.tasaDirecta === null && (t.cifPresupuestado === null || t.baseEstimada === null || Number(t.baseEstimada) <= 0))
      throw new ErrorNegocio(`${ACTIVIDADES_CIF[actividad].nombre}: ingrese la tasa o el CIF presupuestado y un inductor estimado mayor que cero`);
    return [{ actividad, ...t }];
  });
}

export async function guardarParametroCIF(tx: Tx, u: UsuarioActual, entrada: z.input<typeof esquemaParametroCIF> & Record<string, unknown>) {
  exigir(u, "cif.configurar");
  const r = esquemaParametroCIF.safeParse(entrada);
  if (!r.success) throw new ErrorNegocio(r.error.issues[0].message);
  const datos = r.data;
  const tasas = datos.base === "ACTIVIDADES" ? tasasDelFormulario(entrada) : [];
  if (datos.base === "ACTIVIDADES" && tasas.length === 0) throw new ErrorNegocio("Configure la tasa de al menos una actividad");
  if (datos.base !== "ACTIVIDADES" && datos.tasaDirecta === null && datos.base !== "NUMERO_PROYECTOS" && Number(datos.baseEstimada) <= 0)
    throw new ErrorNegocio("La base total estimada del período debe ser mayor que cero");
  const antes = await tx.parametroCIF.findUnique({ where: { periodo: datos.periodo }, ...conTasas });
  const p = await tx.parametroCIF.upsert({ where: { periodo: datos.periodo }, create: datos, update: datos });
  await tx.tasaActividadCIF.deleteMany({ where: { parametroId: p.id } });
  if (tasas.length) await tx.tasaActividadCIF.createMany({ data: tasas.map((t) => ({ parametroId: p.id, ...t })) });
  const resumenTasas = (ts: { actividad: string; tasaDirecta: unknown; cifPresupuestado: unknown; baseEstimada: unknown }[]) =>
    ts.map((t) => `${t.actividad}: ${t.tasaDirecta ?? `${t.cifPresupuestado} ÷ ${t.baseEstimada}`}`).join("; ") || null;
  await auditar(
    tx,
    u,
    "ParametroCIF",
    p.id,
    antes ? { ...antes, tasasActividad: resumenTasas(antes.tasasActividad.map((t) => ({ ...t, tasaDirecta: t.tasaDirecta?.toString(), cifPresupuestado: t.cifPresupuestado?.toString(), baseEstimada: t.baseEstimada?.toString() }))) } : null,
    { ...p, tasasActividad: resumenTasas(tasas) },
    ["base", "tasaDirecta", "cifPresupuestado", "baseEstimada", "tasasActividad"],
  );
  return p;
}
