import type { TipoMovimiento } from "@prisma/client";
import { z } from "zod";
import {
  aplicarMovimiento,
  calcularLineaMaterial,
  costoPromedioEntregado,
  d,
  ErrorCosteo,
  formatearFecha,
  saldoInicial,
  type SaldoInventario,
} from "@/lib/costeo";
import { exigir, type UsuarioActual } from "@/lib/auth/permisos";
import { auditar } from "./auditoria";
import { exigirEditable } from "./ordenes";
import { aFechaDB, aISO, ErrorNegocio, txt, type Tx } from "./util";

const fecha = z.string({ required_error: "Indique la fecha" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const cantidad = z
  .string({ required_error: "Indique la cantidad" })
  .trim()
  .transform((v) => v.replace(",", "."))
  .refine((v) => /^\d+(\.\d+)?$/.test(v) && Number(v) > 0, "La cantidad debe ser mayor que cero");
const decimal = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v.replace(",", ".") : null))
  .refine((v) => v === null || /^\d+(\.\d+)?$/.test(v), "El costo debe ser un número no negativo");
const texto = z.string().trim().optional().nullable().transform((v) => v || null);

function validar<T extends z.ZodTypeAny>(esquema: T, datos: unknown): z.output<T> {
  const r = esquema.safeParse(datos);
  if (!r.success) throw new ErrorNegocio(r.error.issues[0].message);
  return r.data;
}

function motor<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof ErrorCosteo) throw new ErrorNegocio(e.message);
    throw e;
  }
}

/** Saldo actual de un material (último movimiento del kárdex). */
export async function saldoMaterial(tx: Tx, materialId: string): Promise<SaldoInventario & { ultimaFecha: string | null }> {
  const ultimo = await tx.movimientoInventario.findFirst({ where: { materialId }, orderBy: { secuencia: "desc" } });
  if (!ultimo) return { ...saldoInicial(), ultimaFecha: null };
  return {
    cantidad: d(ultimo.saldoCantidad.toString()),
    valor: d(ultimo.saldoValor.toString()),
    costoPromedio: d(ultimo.costoPromedio.toString()),
    ultimaFecha: aISO(ultimo.fecha),
  };
}

interface DatosMovimiento {
  materialId: string;
  tipo: TipoMovimiento;
  fecha: string;
  cantidad: string;
  costoUnitario?: string | null;
  ordenId?: string | null;
  consumoId?: string | null;
  documento?: string | null;
  tercero?: string | null;
  solicitante?: string | null;
  observaciones?: string | null;
}

/**
 * Registra un movimiento aplicando el promedio ponderado.
 * Bloquea la fila del material para que dos movimientos simultáneos no lean el mismo saldo,
 * y no admite fechas anteriores al último movimiento (cambiarían costos ya cargados a órdenes).
 */
async function registrarMovimiento(tx: Tx, u: UsuarioActual, m: DatosMovimiento) {
  await tx.$executeRaw`SELECT 1 FROM "Material" WHERE "id" = ${m.materialId} FOR UPDATE`;
  const saldo = await saldoMaterial(tx, m.materialId);
  if (saldo.ultimaFecha && m.fecha < saldo.ultimaFecha)
    throw new ErrorNegocio(
      `La fecha no puede ser anterior al último movimiento del material (${formatearFecha(saldo.ultimaFecha)}). Registre el movimiento con fecha igual o posterior`,
    );
  const r = motor(() => aplicarMovimiento(saldo, { tipo: m.tipo, cantidad: m.cantidad, costoUnitario: m.costoUnitario }));
  const mov = await tx.movimientoInventario.create({
    data: {
      materialId: m.materialId,
      tipo: m.tipo,
      fecha: aFechaDB(m.fecha),
      cantidad: m.cantidad,
      costoUnitario: r.costoUnitario.toString(),
      costoTotal: r.costoTotal.toString(),
      saldoCantidad: r.saldo.cantidad.toString(),
      saldoValor: r.saldo.valor.toString(),
      costoPromedio: r.saldo.costoPromedio.toString(),
      ordenId: m.ordenId ?? null,
      consumoId: m.consumoId ?? null,
      documento: m.documento ?? null,
      tercero: m.tercero ?? null,
      solicitante: m.solicitante ?? null,
      observaciones: m.observaciones ?? null,
      autorizadoPorId: u.id,
      autorizadoPorNombre: u.nombre,
    },
  });
  return mov;
}

// ───────────── Entradas y ajustes ─────────────

export const esquemaEntrada = z.object({
  materialId: z.string({ required_error: "Seleccione el material" }).min(1, "Seleccione el material"),
  fecha,
  cantidad,
  costoUnitario: decimal.refine((v) => v !== null, "Indique el costo unitario de adquisición"),
  documento: texto,
  tercero: texto,
  observaciones: texto,
});

export async function registrarEntrada(tx: Tx, u: UsuarioActual, entrada: unknown) {
  exigir(u, "inventario.gestionar");
  const e = validar(esquemaEntrada, entrada);
  return registrarMovimiento(tx, u, { ...e, tipo: "ENTRADA" });
}

export const esquemaAjuste = z.object({
  materialId: z.string({ required_error: "Seleccione el material" }).min(1, "Seleccione el material"),
  fecha,
  tipo: z.enum(["AJUSTE_POSITIVO", "AJUSTE_NEGATIVO"]),
  cantidad,
  costoUnitario: decimal,
  documento: texto,
  observaciones: z
    .string({ required_error: "Indique el motivo del ajuste (por ejemplo, conteo físico)" })
    .trim()
    .min(1, "Indique el motivo del ajuste (por ejemplo, conteo físico)"),
});

export async function registrarAjuste(tx: Tx, u: UsuarioActual, entrada: unknown) {
  exigir(u, "inventario.gestionar");
  const e = validar(esquemaAjuste, entrada);
  return registrarMovimiento(tx, u, { ...e, costoUnitario: e.tipo === "AJUSTE_POSITIVO" ? e.costoUnitario : null });
}

// ───────────── Requisiciones y devoluciones por orden ─────────────

/** Recalcula entregada, devuelta y costo unitario de una línea a partir de sus movimientos. */
async function sincronizarLinea(tx: Tx, u: UsuarioActual, consumoId: string) {
  const antes = await tx.consumoMaterial.findUniqueOrThrow({ where: { id: consumoId }, include: { material: true } });
  const movs = await tx.movimientoInventario.findMany({ where: { consumoId }, orderBy: { secuencia: "asc" } });
  const salidas = movs.filter((x) => x.tipo === "SALIDA_ORDEN");
  const entregada = salidas.reduce((a, x) => a.plus(x.cantidad.toString()), d(0));
  const devuelta = movs.filter((x) => x.tipo === "DEVOLUCION_ORDEN").reduce((a, x) => a.plus(x.cantidad.toString()), d(0));
  const costo = costoPromedioEntregado(salidas.map((x) => ({ cantidad: x.cantidad.toString(), costoTotal: x.costoTotal.toString() })));
  const datos = {
    cantidadEntregada: entregada.toString(),
    cantidadDevuelta: devuelta.toString(),
    costoUnitarioAplicado: (costo ?? d(antes.costoUnitarioAplicado.toString())).toString(),
  };
  motor(() =>
    calcularLineaMaterial({
      descripcion: antes.material.descripcion,
      requerida: antes.cantidadRequerida.toString(),
      entregada: datos.cantidadEntregada,
      utilizada: antes.cantidadUtilizada.toString(),
      devuelta: datos.cantidadDevuelta,
      costoUnitario: datos.costoUnitarioAplicado,
      clasificacionMerma: antes.clasificacionMerma,
      valorRecuperado: antes.valorRecuperado.toString(),
    }),
  );
  const despues = await tx.consumoMaterial.update({ where: { id: consumoId }, data: datos });
  await auditar(tx, u, "ConsumoMaterial", consumoId, antes, despues, ["cantidadEntregada", "cantidadDevuelta", "costoUnitarioAplicado"]);
  return despues;
}

async function ordenAbierta(tx: Tx, ordenId: string) {
  const orden = await tx.ordenProyecto.findFirst({ where: { id: ordenId, eliminadoEn: null } });
  if (!orden) throw new ErrorNegocio("La orden no existe");
  exigirEditable(orden);
  return orden;
}

export const esquemaRequisicion = z.object({
  materialId: z.string({ required_error: "Seleccione el material" }).min(1, "Seleccione el material"),
  fecha,
  cantidad,
  solicitante: z.string({ required_error: "Indique quién solicita el material" }).trim().min(1, "Indique quién solicita el material"),
  documento: texto,
  etapaId: texto,
  observaciones: texto,
});

/**
 * Requisición: salida del almacén hacia la orden, valorada al promedio ponderado vigente.
 * Se carga a la línea del material en la orden (se crea si no existe).
 */
export async function registrarRequisicion(tx: Tx, u: UsuarioActual, ordenId: string, entrada: unknown) {
  exigir(u, "inventario.gestionar");
  await ordenAbierta(tx, ordenId);
  const e = validar(esquemaRequisicion, entrada);
  let linea = await tx.consumoMaterial.findFirst({
    where: { ordenId, materialId: e.materialId, eliminadoEn: null },
    include: { _count: { select: { movimientos: true } } },
    orderBy: { creadoEn: "asc" },
  });
  if (linea && linea._count.movimientos === 0 && (d(txt(linea.cantidadEntregada)).greaterThan(0) || d(linea.cantidadDevuelta.toString()).greaterThan(0)))
    throw new ErrorNegocio(
      "La línea de este material ya tiene cantidades entregadas o devueltas registradas manualmente. Déjelas en cero antes de usar requisiciones del almacén",
    );
  if (!linea) {
    const creada = await tx.consumoMaterial.create({
      data: { ordenId, materialId: e.materialId, etapaId: e.etapaId, cantidadRequerida: "0", costoUnitarioAplicado: "0" },
    });
    linea = { ...creada, _count: { movimientos: 0 } };
  }
  const mov = await registrarMovimiento(tx, u, { ...e, tipo: "SALIDA_ORDEN", ordenId, consumoId: linea.id });
  await sincronizarLinea(tx, u, linea.id);
  return mov;
}

export const esquemaDevolucion = z.object({
  consumoId: z.string().min(1),
  fecha,
  cantidad,
  solicitante: texto,
  documento: texto,
  observaciones: texto,
});

/** Devolución de material sobrante al almacén, valorada al costo con que salió hacia la orden. */
export async function registrarDevolucion(tx: Tx, u: UsuarioActual, ordenId: string, entrada: unknown) {
  exigir(u, "inventario.gestionar");
  await ordenAbierta(tx, ordenId);
  const e = validar(esquemaDevolucion, entrada);
  const linea = await tx.consumoMaterial.findFirst({
    where: { id: e.consumoId, ordenId, eliminadoEn: null },
    include: { _count: { select: { movimientos: true } } },
  });
  if (!linea) throw new ErrorNegocio("La línea de material no existe");
  if (linea._count.movimientos === 0)
    throw new ErrorNegocio("Esta línea no tiene entregas del almacén registradas; la devolución solo aplica a materiales entregados por requisición");
  // Validar antes de escribir el movimiento: la devolución no puede dejar merma negativa.
  const material = await tx.material.findUniqueOrThrow({ where: { id: linea.materialId } });
  motor(() =>
    calcularLineaMaterial({
      descripcion: material.descripcion,
      requerida: linea.cantidadRequerida.toString(),
      entregada: txt(linea.cantidadEntregada),
      utilizada: linea.cantidadUtilizada.toString(),
      devuelta: d(linea.cantidadDevuelta.toString()).plus(e.cantidad),
      costoUnitario: linea.costoUnitarioAplicado.toString(),
    }),
  );
  const mov = await registrarMovimiento(tx, u, {
    materialId: linea.materialId,
    tipo: "DEVOLUCION_ORDEN",
    fecha: e.fecha,
    cantidad: e.cantidad,
    costoUnitario: linea.costoUnitarioAplicado.toString(),
    ordenId,
    consumoId: linea.id,
    documento: e.documento,
    solicitante: e.solicitante,
    observaciones: e.observaciones,
  });
  await sincronizarLinea(tx, u, linea.id);
  return mov;
}

// ───────────── Consultas ─────────────

export async function inventarioActual(tx: Tx) {
  const materiales = await tx.material.findMany({ where: { eliminadoEn: null }, orderBy: { codigo: "asc" } });
  const ultimos = await tx.movimientoInventario.findMany({
    where: { materialId: { in: materiales.map((m) => m.id) } },
    distinct: ["materialId"],
    orderBy: [{ materialId: "asc" }, { secuencia: "desc" }],
  });
  const porMaterial = new Map(ultimos.map((u) => [u.materialId, u]));
  return materiales.map((m) => {
    const u = porMaterial.get(m.id);
    return {
      material: m,
      cantidad: u?.saldoCantidad.toString() ?? "0",
      costoPromedio: u?.costoPromedio.toString() ?? null,
      valor: u?.saldoValor.toString() ?? "0",
      ultimaFecha: aISO(u?.fecha),
    };
  });
}
