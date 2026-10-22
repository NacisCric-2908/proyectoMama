import { z } from "zod";
import { conciliarCIF, d, ErrorCosteo, estaCerrada, sumar, type EstadoOrden, type PoliticaAjusteCIF } from "@/lib/costeo";
import { exigir, type UsuarioActual } from "@/lib/auth/permisos";
import { auditar } from "./auditoria";
import type { SnapshotCierre } from "./ordenes";
import { ErrorNegocio, type Tx } from "./util";

const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

function validarPeriodo(periodo: string) {
  if (!PERIODO.test(periodo)) throw new ErrorNegocio("Período inválido (aaaa-mm)");
}

export async function conciliacionVigente(tx: Tx, periodo: string) {
  return tx.conciliacionCIF.findFirst({ where: { periodo, anuladaEn: null }, include: { ajustes: true } });
}

async function exigirSinConciliacion(tx: Tx, periodo: string) {
  if (await conciliacionVigente(tx, periodo))
    throw new ErrorNegocio(`El período ${periodo} ya está conciliado. Anule la conciliación para modificar el CIF real`);
}

// ───────────── CIF real por concepto ─────────────

export const esquemaConceptoCIF = z.object({
  periodo: z.string(),
  concepto: z.string().trim().min(1, "Indique el concepto"),
  valor: z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => /^\d+(\.\d+)?$/.test(v), "El valor debe ser un número no negativo"),
  soporte: z.string().trim().optional().nullable().transform((v) => v || null),
  observaciones: z.string().trim().optional().nullable().transform((v) => v || null),
});

export async function agregarConceptoCIFReal(tx: Tx, u: UsuarioActual, entrada: unknown) {
  exigir(u, "cif.conciliar");
  const r = esquemaConceptoCIF.safeParse(entrada);
  if (!r.success) throw new ErrorNegocio(r.error.issues[0].message);
  validarPeriodo(r.data.periodo);
  await exigirSinConciliacion(tx, r.data.periodo);
  const c = await tx.conceptoCIFReal.create({ data: { ...r.data, creadoPorId: u.id } });
  await auditar(tx, u, "ConceptoCIFReal", c.id, null, c, ["periodo", "concepto", "valor", "soporte"]);
  return c;
}

export async function eliminarConceptoCIFReal(tx: Tx, u: UsuarioActual, id: string) {
  exigir(u, "cif.conciliar");
  const c = await tx.conceptoCIFReal.findFirst({ where: { id, eliminadoEn: null } });
  if (!c) throw new ErrorNegocio("El concepto no existe");
  await exigirSinConciliacion(tx, c.periodo);
  await tx.conceptoCIFReal.update({ where: { id }, data: { eliminadoEn: new Date() } });
  await auditar(tx, u, "ConceptoCIFReal", id, c, null, ["concepto", "valor"]);
}

// ───────────── Conciliación ─────────────

/**
 * Datos del período: CIF real (suma de conceptos) y órdenes con CIF asignado en el período.
 * Solo se concilia cuando todas las órdenes no anuladas del período están cerradas,
 * porque el CIF aplicado de una orden abierta todavía puede cambiar.
 */
export async function datosPeriodo(tx: Tx, periodo: string) {
  validarPeriodo(periodo);
  const [conceptos, ordenes] = await Promise.all([
    tx.conceptoCIFReal.findMany({ where: { periodo, eliminadoEn: null }, orderBy: { creadoEn: "asc" } }),
    tx.ordenProyecto.findMany({
      where: { eliminadoEn: null, estado: { not: "ANULADO" }, asignacionCIF: { periodo } },
      select: { id: true, codigo: true, estado: true, valorCotizado: true, snapshotCierre: true },
      orderBy: { codigo: "asc" },
    }),
  ]);
  const pendientes = ordenes.filter((o) => !estaCerrada(o.estado as EstadoOrden) || !o.snapshotCierre);
  const cerradas = ordenes
    .filter((o) => !pendientes.includes(o))
    .map((o) => {
      const r = (o.snapshotCierre as unknown as SnapshotCierre).resumen;
      return {
        id: o.id,
        codigo: o.codigo,
        cifAplicado: r.cif?.valor ?? "0",
        costoTotal: r.costoTotal,
        valorCotizado: o.valorCotizado?.toString() ?? null,
      };
    });
  return { conceptos, cifReal: sumar(conceptos.map((c) => d(c.valor.toString()))).toString(), pendientes: pendientes.map((o) => ({ id: o.id, codigo: o.codigo, estado: o.estado })), cerradas };
}

/** Vista previa de la conciliación (no guarda nada). */
export async function previsualizarConciliacion(tx: Tx, periodo: string, politica: PoliticaAjusteCIF) {
  const datos = await datosPeriodo(tx, periodo);
  let resultado = null;
  let error: string | null = null;
  try {
    resultado = conciliarCIF(datos.cifReal, datos.cerradas, politica);
  } catch (e) {
    if (e instanceof ErrorCosteo) error = e.message;
    else throw e;
  }
  return { ...datos, resultado, error };
}

export async function conciliarPeriodo(tx: Tx, u: UsuarioActual, periodo: string, politica: PoliticaAjusteCIF, observaciones?: string | null) {
  exigir(u, "cif.conciliar");
  await exigirSinConciliacion(tx, periodo);
  const datos = await datosPeriodo(tx, periodo);
  if (datos.conceptos.length === 0) throw new ErrorNegocio("Registre el CIF real del período antes de conciliar");
  if (datos.pendientes.length)
    throw new ErrorNegocio(
      `Hay órdenes del período sin cerrar: ${datos.pendientes.map((o) => o.codigo).join(", ")}. Ciérrelas o anúlelas antes de conciliar`,
      datos.pendientes.map((o) => o.codigo),
    );
  let r;
  try {
    r = conciliarCIF(datos.cifReal, datos.cerradas, politica);
  } catch (e) {
    if (e instanceof ErrorCosteo) throw new ErrorNegocio(e.message);
    throw e;
  }
  const c = await tx.conciliacionCIF.create({
    data: {
      periodo,
      cifReal: r.cifReal.toString(),
      cifAplicado: r.cifAplicado.toString(),
      diferencia: r.diferencia.toString(),
      ajusteCostoVentas: r.ajusteCostoVentas.toString(),
      politica,
      observaciones: observaciones?.trim() || null,
      usuarioId: u.id,
      usuarioNombre: u.nombre,
      ajustes: {
        create: r.ajustes.map((a) => ({
          ordenId: a.id,
          cifAplicado: a.cifAplicado.toString(),
          ajuste: a.ajuste.toString(),
          costoAcumulado: a.costoAcumulado.toString(),
          costoAjustado: a.costoAjustado.toString(),
        })),
      },
    },
  });
  await auditar(tx, u, "ConciliacionCIF", c.id, null, {
    periodo,
    cifReal: c.cifReal,
    cifAplicado: c.cifAplicado,
    diferencia: c.diferencia,
    politica,
  });
  return c;
}

export async function anularConciliacion(tx: Tx, u: UsuarioActual, id: string, motivo: string) {
  exigir(u, "cif.conciliar");
  if (!motivo?.trim()) throw new ErrorNegocio("Indique el motivo de la anulación");
  const c = await tx.conciliacionCIF.findFirst({ where: { id, anuladaEn: null } });
  if (!c) throw new ErrorNegocio("La conciliación no existe o ya fue anulada");
  await tx.conciliacionCIF.update({ where: { id }, data: { anuladaEn: new Date(), anuladaPor: u.nombre, motivoAnulacion: motivo.trim() } });
  await auditar(tx, u, "ConciliacionCIF", id, { estado: "vigente" }, { estado: "anulada", motivo: motivo.trim() });
}
