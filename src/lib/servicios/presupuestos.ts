import type { PresupuestoOrden } from "@prisma/client";
import { z } from "zod";
import { compararConPresupuesto, elegirPresupuestos, ErrorCosteo, totalPresupuesto } from "@/lib/costeo";
import { exigir, type UsuarioActual } from "@/lib/auth/permisos";
import { auditar } from "./auditoria";
import { exigirEditable, exigirVerOrden } from "./ordenes";
import { ErrorNegocio, type Tx } from "./util";

const valor = (campo: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((v) => (v === undefined || v === null || v === "" ? "0" : String(v).trim().replace(",", ".")))
    .refine((v) => /^\d+(\.\d+)?$/.test(v), `${campo}: debe ser un número no negativo`);

export const esquemaPresupuesto = z.object({
  materialesDirectos: valor("Materiales directos"),
  manoObraDirecta: valor("Mano de obra directa"),
  ingenieriaAutomatizacion: valor("Ingeniería y automatización"),
  pruebasPuestaMarcha: valor("Pruebas y puesta en marcha"),
  cif: valor("CIF"),
  mermas: valor("Mermas"),
  horasEnsamble: valor("Horas de ensamble"),
  horasIngenieria: valor("Horas de ingeniería"),
  motivo: z.string().trim().optional().nullable().transform((v) => v || null),
});

const CAMPOS = ["materialesDirectos", "manoObraDirecta", "ingenieriaAutomatizacion", "pruebasPuestaMarcha", "cif", "mermas", "horasEnsamble", "horasIngenieria", "motivo"];

async function ordenEditable(tx: Tx, u: UsuarioActual, ordenId: string) {
  const orden = await tx.ordenProyecto.findFirst({ where: { id: ordenId, eliminadoEn: null }, include: { tecnicos: true } });
  if (!orden) throw new ErrorNegocio("La orden no existe");
  exigirVerOrden(u, orden);
  exigirEditable(orden);
  return orden;
}

/**
 * Registra una nueva versión del presupuesto de costo. Las versiones no se modifican:
 * para corregir o reflejar un cambio de especificación se crea otra versión con su motivo.
 */
export async function crearVersionPresupuesto(tx: Tx, u: UsuarioActual, ordenId: string, entrada: unknown): Promise<PresupuestoOrden> {
  exigir(u, "ordenes.editar");
  await ordenEditable(tx, u, ordenId);
  const r = esquemaPresupuesto.safeParse(entrada);
  if (!r.success) throw new ErrorNegocio(r.error.issues[0].message);
  const datos = r.data;
  try {
    totalPresupuesto(datos);
  } catch (e) {
    if (e instanceof ErrorCosteo) throw new ErrorNegocio(e.message);
    throw e;
  }
  const ultima = await tx.presupuestoOrden.findFirst({ where: { ordenId }, orderBy: { version: "desc" } });
  const version = (ultima?.version ?? 0) + 1;
  if (version > 1 && !datos.motivo)
    throw new ErrorNegocio("Indique el motivo de la nueva versión (por ejemplo, el cambio de especificación autorizado)");
  const p = await tx.presupuestoOrden.create({
    data: { ordenId, version, ...datos, creadoPorId: u.id, creadoPorNombre: u.nombre },
  });
  await auditar(tx, u, "PresupuestoOrden", ordenId, null, { version, ...datos }, ["version", ...CAMPOS]);
  return p;
}

/** Aprueba una versión del presupuesto (aprobación verificable, con usuario y fecha). */
export async function aprobarPresupuesto(tx: Tx, u: UsuarioActual, ordenId: string, presupuestoId: string) {
  exigir(u, "presupuesto.aprobar");
  await ordenEditable(tx, u, ordenId);
  const p = await tx.presupuestoOrden.findFirst({ where: { id: presupuestoId, ordenId } });
  if (!p) throw new ErrorNegocio("La versión del presupuesto no existe");
  if (p.aprobadoEn) throw new ErrorNegocio(`La versión ${p.version} ya fue aprobada`);
  const aprobado = await tx.presupuestoOrden.update({
    where: { id: p.id },
    data: { aprobadoPorId: u.id, aprobadoPorNombre: u.nombre, aprobadoEn: new Date() },
  });
  await auditar(tx, u, "PresupuestoOrden", ordenId, { [`versión ${p.version}`]: "sin aprobar" }, { [`versión ${p.version}`]: "aprobada" });
  return aprobado;
}

/** Componentes de una versión como strings, para el motor y para enviar al navegador. */
export function componentesDe(p: PresupuestoOrden) {
  return {
    materialesDirectos: p.materialesDirectos.toString(),
    manoObraDirecta: p.manoObraDirecta.toString(),
    ingenieriaAutomatizacion: p.ingenieriaAutomatizacion.toString(),
    pruebasPuestaMarcha: p.pruebasPuestaMarcha.toString(),
    cif: p.cif.toString(),
    mermas: p.mermas.toString(),
    horasEnsamble: p.horasEnsamble.toString(),
    horasIngenieria: p.horasIngenieria.toString(),
  };
}

/** Comparaciones del costo acumulado contra el presupuesto original y el vigente (aprobados). */
export function comparacionesDe(
  presupuestos: PresupuestoOrden[],
  r: { elementos: Record<string, string>; costoTotal: string; mod: { horasMOD: string }; ingenieria: { horasIngenieria: string } },
) {
  const { original, vigente } = elegirPresupuestos(presupuestos);
  const real = { elementos: r.elementos as never, costoTotal: r.costoTotal, horasMOD: r.mod.horasMOD, horasIngenieria: r.ingenieria.horasIngenieria };
  return {
    original,
    vigente,
    vsOriginal: original ? compararConPresupuesto(componentesDe(original), real) : null,
    vsVigente: vigente && vigente.id !== original?.id ? compararConPresupuesto(componentesDe(vigente), real) : null,
  };
}
