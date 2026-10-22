import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  calcularResumen,
  esEditable,
  estaCerrada,
  hoyBogota,
  serializar,
  type EntradaOrden,
  type EstadoOrden,
  type EtapaInfo,
  type ResumenCostos,
  type Serializado,
} from "@/lib/costeo";
import { exigir, ErrorPermiso, tiene, type UsuarioActual } from "@/lib/auth/permisos";
import { auditar } from "./auditoria";
import { siguienteCodigo } from "./codigoOrden";
import { asignarCIFAutomatico } from "./cif";
import { aFechaDB, aISO, ErrorNegocio, txt, type Tx } from "./util";

export type ResumenSerializado = Serializado<ResumenCostos>;

export interface SnapshotCierre {
  resumen: ResumenSerializado;
  cerradoEn: string;
  cerradoPor: string;
}

const vivos = { eliminadoEn: null };

export const incluirOrden = {
  cliente: true,
  responsable: { select: { id: true, nombre: true } },
  materiales: { where: vivos, include: { material: true, etapa: true }, orderBy: { creadoEn: "asc" } },
  registrosMOD: { where: vivos, include: { trabajador: true }, orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }] },
  registrosIng: {
    where: vivos,
    include: { etapa: true, responsable: true },
    orderBy: [{ fechaInicio: "asc" }, { creadoEn: "asc" }],
  },
  servicios: { where: vivos, include: { etapa: true }, orderBy: { creadoEn: "asc" } },
  asignacionCIF: true,
  historial: { orderBy: { fecha: "desc" } },
  tecnicos: true,
} satisfies Prisma.OrdenProyectoInclude;

export type OrdenCompleta = Prisma.OrdenProyectoGetPayload<{ include: typeof incluirOrden }>;

export async function cargarOrden(tx: Tx, id: string): Promise<OrdenCompleta> {
  const orden = await tx.ordenProyecto.findFirst({ where: { id, eliminadoEn: null }, include: incluirOrden });
  if (!orden) throw new ErrorNegocio("La orden no existe");
  return orden;
}

export async function etapasCatalogo(tx: Tx): Promise<EtapaInfo[]> {
  const etapas = await tx.etapa.findMany({ orderBy: { orden: "asc" } });
  return etapas.map((e) => ({ id: e.id, nombre: e.nombre, grupo: e.grupo, orden: e.orden }));
}

export async function parametros(tx: Tx) {
  const p = await tx.parametrosGenerales.findUnique({ where: { id: 1 } });
  if (!p) throw new ErrorNegocio("Faltan los parámetros generales. Ejecute la semilla de la base de datos");
  return p;
}

/** Convierte una orden de la BD en la entrada del motor de cálculo. */
export function entradaMotor(
  o: OrdenCompleta,
  etapas: EtapaInfo[],
  umbralMermaPct: string,
  hoy: string = hoyBogota(),
): EntradaOrden {
  return {
    estado: o.estado as EstadoOrden,
    cantidadUnidades: o.cantidadUnidades.toString(),
    valorCotizado: txt(o.valorCotizado),
    margenEsperadoPct: txt(o.margenEsperadoPct),
    margenMinimoPct: txt(o.margenMinimoPct),
    fechaEstimadaEntrega: aISO(o.fechaEstimadaEntrega),
    hoy,
    umbralMermaPct,
    etapas,
    materiales: o.materiales.map((m) => ({
      id: m.id,
      codigo: m.material.codigo,
      descripcion: m.material.descripcion,
      unidad: m.material.unidad,
      etapaId: m.etapaId,
      requerida: m.cantidadRequerida.toString(),
      entregada: txt(m.cantidadEntregada),
      utilizada: m.cantidadUtilizada.toString(),
      devuelta: m.cantidadDevuelta.toString(),
      costoUnitario: m.costoUnitarioAplicado.toString(),
    })),
    mod: o.registrosMOD.map((r) => ({
      id: r.id,
      trabajador: r.trabajador?.nombre ?? r.cargo ?? null,
      actividad: r.actividad,
      fecha: aISO(r.fecha) ?? undefined,
      horas: r.horas.toString(),
      tarifa: r.tarifaAplicada.toString(),
    })),
    ingenieria: o.registrosIng.map((r) => ({
      id: r.id,
      etapaId: r.etapaId,
      responsable: r.responsable.nombre,
      fechaInicio: aISO(r.fechaInicio),
      fechaFin: aISO(r.fechaFin),
      horas: r.horas.toString(),
      costoHora: r.costoHoraAplicado.toString(),
    })),
    servicios: o.servicios.map((s) => ({
      id: s.id,
      etapaId: s.etapaId,
      descripcion: s.descripcion,
      valor: s.valor.toString(),
    })),
    cif: o.asignacionCIF ? { base: o.asignacionCIF.base, tasa: o.asignacionCIF.tasaAplicada.toString() } : null,
  };
}

export async function calcularResumenVivo(tx: Tx, o: OrdenCompleta): Promise<ResumenCostos> {
  const [etapas, p] = await Promise.all([etapasCatalogo(tx), parametros(tx)]);
  return calcularResumen(entradaMotor(o, etapas, p.umbralMermaPct.toString()));
}

/**
 * Resumen a mostrar: el snapshot congelado si la orden está cerrada,
 * o el cálculo en tiempo real si está abierta.
 */
export async function resumenOrden(tx: Tx, o: OrdenCompleta): Promise<ResumenSerializado> {
  if (estaCerrada(o.estado as EstadoOrden) && o.snapshotCierre) {
    return (o.snapshotCierre as unknown as SnapshotCierre).resumen;
  }
  return serializar(await calcularResumenVivo(tx, o));
}

// ───────────── Acceso ─────────────

export function puedeVerOrden(u: UsuarioActual, o: { responsableId: string | null; tecnicos: { trabajadorId: string }[] }) {
  if (tiene(u, "ordenes.verTodas")) return true;
  if (tiene(u, "ordenes.verPropias") && o.responsableId === u.id) return true;
  if (tiene(u, "ordenes.verAsignadas") && u.trabajadorId && o.tecnicos.some((t) => t.trabajadorId === u.trabajadorId))
    return true;
  return false;
}

export function exigirVerOrden(u: UsuarioActual, o: Parameters<typeof puedeVerOrden>[1]) {
  if (!puedeVerOrden(u, o)) throw new ErrorPermiso("No tiene acceso a esta orden");
}

export function exigirEditable(o: { estado: string }) {
  if (!esEditable(o.estado as EstadoOrden))
    throw new ErrorNegocio("La orden está cerrada o anulada y no se puede modificar");
}

/** Filtro de Prisma con las órdenes que el usuario puede ver. */
export function filtroVisibilidad(u: UsuarioActual): Prisma.OrdenProyectoWhereInput {
  if (tiene(u, "ordenes.verTodas")) return {};
  const o: Prisma.OrdenProyectoWhereInput[] = [];
  if (tiene(u, "ordenes.verPropias")) o.push({ responsableId: u.id });
  if (tiene(u, "ordenes.verAsignadas") && u.trabajadorId) o.push({ tecnicos: { some: { trabajadorId: u.trabajadorId } } });
  return o.length ? { OR: o } : { id: "__ninguna__" };
}

// ───────────── Crear / editar ─────────────

const decimalOpcional = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v === undefined ? undefined : v ? v.replace(",", ".") : null))
  .refine((v) => v == null || /^-?\d+(\.\d+)?$/.test(v), "Debe ser un número válido");

const fechaOpcional = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === undefined ? undefined : v || null))
  .refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida");

export const esquemaOrden = z
  .object({
    codigo: z.string().trim().max(40).optional().nullable(),
    clienteId: z.string().optional().nullable().transform((v) => (v === undefined ? undefined : v || null)),
    descripcion: z.string().trim().optional(),
    cantidadUnidades: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(",", ".") : undefined))
      .refine((v) => v === undefined || (/^\d+(\.\d+)?$/.test(v) && Number(v) > 0), "La cantidad de unidades debe ser mayor que cero"),
    fechaCreacion: fechaOpcional,
    fechaEstimadaEntrega: fechaOpcional,
    responsableId: z.string().optional().nullable().transform((v) => (v === undefined ? undefined : v || null)),
    valorCotizado: decimalOpcional.refine((v) => v == null || Number(v) >= 0, "No se permiten valores negativos"),
    margenEsperadoPct: decimalOpcional.refine(
      (v) => v == null || (Number(v) >= 0 && Number(v) < 100),
      "El margen esperado debe ser mayor o igual a 0 y menor que 100 %",
    ),
    margenMinimoPct: decimalOpcional.refine((v) => v == null || (Number(v) >= 0 && Number(v) < 100), "Margen mínimo inválido"),
    observaciones: z.string().optional().nullable(),
    tecnicos: z.array(z.string()).optional(),
  });

export type DatosOrden = z.input<typeof esquemaOrden>;

function validar<T extends z.ZodTypeAny>(esquema: T, datos: unknown): z.output<T> {
  const r = esquema.safeParse(datos);
  if (!r.success) {
    const errores = r.error.issues.map((i) => i.message);
    throw new ErrorNegocio(errores[0], errores);
  }
  return r.data;
}

const CAMPOS_AUDITADOS_ORDEN = [
  "codigo",
  "clienteId",
  "descripcion",
  "cantidadUnidades",
  "fechaEstimadaEntrega",
  "responsableId",
  "valorCotizado",
  "margenEsperadoPct",
  "margenMinimoPct",
  "observaciones",
];

export async function crearOrden(tx: Tx, u: UsuarioActual, datos: DatosOrden) {
  exigir(u, "ordenes.editar");
  const d = validar(esquemaOrden, datos);
  const p = await parametros(tx);
  const fechaCreacion = d.fechaCreacion ?? hoyBogota();
  const codigo = d.codigo?.trim() || (await siguienteCodigo(tx, p.formatoCodigoOrden, Number(fechaCreacion.slice(0, 4))));
  if (await tx.ordenProyecto.findUnique({ where: { codigo } })) throw new ErrorNegocio(`El código ${codigo} ya existe`);

  const orden = await tx.ordenProyecto.create({
    data: {
      codigo,
      clienteId: d.clienteId,
      descripcion: d.descripcion ?? "",
      cantidadUnidades: d.cantidadUnidades ?? "1",
      fechaCreacion: aFechaDB(fechaCreacion),
      fechaEstimadaEntrega: d.fechaEstimadaEntrega ? aFechaDB(d.fechaEstimadaEntrega) : null,
      responsableId: d.responsableId ?? u.id,
      valorCotizado: d.valorCotizado,
      margenEsperadoPct: d.margenEsperadoPct,
      margenMinimoPct: d.margenMinimoPct ?? p.margenMinimoGlobal,
      observaciones: d.observaciones ?? null,
      creadoPorId: u.id,
      modificadoPorId: u.id,
      tecnicos: d.tecnicos?.length ? { create: d.tecnicos.map((trabajadorId) => ({ trabajadorId })) } : undefined,
      historial: { create: { estadoAnterior: null, estadoNuevo: "BORRADOR", usuarioId: u.id, usuarioNombre: u.nombre, comentario: "Orden creada" } },
    },
  });
  await auditar(tx, u, "OrdenProyecto", orden.id, null, orden, CAMPOS_AUDITADOS_ORDEN);
  await asignarCIFAutomatico(tx, u, orden.id);
  return orden;
}

export async function actualizarOrden(tx: Tx, u: UsuarioActual, id: string, datos: DatosOrden) {
  exigir(u, "ordenes.editar");
  const actual = await cargarOrden(tx, id);
  exigirVerOrden(u, actual);
  exigirEditable(actual);
  const d = validar(esquemaOrden, datos);

  let codigo = actual.codigo;
  if (d.codigo && d.codigo.trim() !== actual.codigo) {
    if (actual.estado !== "BORRADOR") throw new ErrorNegocio("El código solo se puede editar mientras la orden está en Borrador");
    codigo = d.codigo.trim();
    if (await tx.ordenProyecto.findUnique({ where: { codigo } })) throw new ErrorNegocio(`El código ${codigo} ya existe`);
  }
  if (actual.estado !== "BORRADOR") {
    const faltan = [];
    if (d.clienteId === null) faltan.push("Cliente");
    if (d.descripcion !== undefined && !d.descripcion.trim()) faltan.push("Descripción");
    if (d.fechaEstimadaEntrega === null) faltan.push("Fecha estimada de entrega");
    if (d.valorCotizado === null || (d.valorCotizado !== undefined && Number(d.valorCotizado) <= 0)) faltan.push("Valor cotizado");
    if (faltan.length) throw new ErrorNegocio(`Una orden activa debe tener: ${faltan.join(", ")}`, faltan);
  }

  const nueva = await tx.ordenProyecto.update({
    where: { id },
    data: {
      codigo,
      clienteId: d.clienteId,
      descripcion: d.descripcion,
      cantidadUnidades: d.cantidadUnidades,
      fechaEstimadaEntrega: d.fechaEstimadaEntrega === undefined ? undefined : d.fechaEstimadaEntrega ? aFechaDB(d.fechaEstimadaEntrega) : null,
      responsableId: d.responsableId ?? undefined,
      valorCotizado: d.valorCotizado,
      margenEsperadoPct: d.margenEsperadoPct,
      margenMinimoPct: d.margenMinimoPct,
      observaciones: d.observaciones,
      modificadoPorId: u.id,
    },
  });
  if (d.tecnicos) {
    await tx.asignacionTecnico.deleteMany({ where: { ordenId: id } });
    if (d.tecnicos.length)
      await tx.asignacionTecnico.createMany({ data: d.tecnicos.map((trabajadorId) => ({ ordenId: id, trabajadorId })) });
  }
  await auditar(tx, u, "OrdenProyecto", id, actual, nueva, CAMPOS_AUDITADOS_ORDEN);
  return nueva;
}

// ───────────── Listado ─────────────

export interface FiltrosOrdenes {
  q?: string;
  clienteId?: string;
  estado?: string;
  responsableId?: string;
  desde?: string;
  hasta?: string;
  conAlertas?: boolean;
}

export async function listarOrdenes(tx: Tx, u: UsuarioActual, f: FiltrosOrdenes = {}) {
  const where: Prisma.OrdenProyectoWhereInput = {
    AND: [
      { eliminadoEn: null },
      filtroVisibilidad(u),
      f.q
        ? {
            OR: [
              { codigo: { contains: f.q, mode: "insensitive" } },
              { descripcion: { contains: f.q, mode: "insensitive" } },
              { cliente: { nombre: { contains: f.q, mode: "insensitive" } } },
            ],
          }
        : {},
      f.clienteId ? { clienteId: f.clienteId } : {},
      f.estado ? { estado: f.estado as EstadoOrden } : {},
      f.responsableId ? { responsableId: f.responsableId } : {},
      f.desde ? { fechaCreacion: { gte: aFechaDB(f.desde) } } : {},
      f.hasta ? { fechaCreacion: { lte: aFechaDB(f.hasta) } } : {},
    ],
  };
  const [ordenes, etapas, p] = await Promise.all([
    tx.ordenProyecto.findMany({ where, include: incluirOrden, orderBy: { codigo: "desc" } }),
    etapasCatalogo(tx),
    parametros(tx),
  ]);
  const hoy = hoyBogota();
  const filas = ordenes.map((o) => {
    let resumen: ResumenSerializado | null = null;
    let error: string | null = null;
    try {
      resumen =
        estaCerrada(o.estado as EstadoOrden) && o.snapshotCierre
          ? (o.snapshotCierre as unknown as SnapshotCierre).resumen
          : serializar(calcularResumen(entradaMotor(o, etapas, p.umbralMermaPct.toString(), hoy)));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    return {
      id: o.id,
      codigo: o.codigo,
      cliente: o.cliente?.nombre ?? null,
      descripcion: o.descripcion,
      estado: o.estado as EstadoOrden,
      responsable: o.responsable?.nombre ?? null,
      fechaEstimadaEntrega: aISO(o.fechaEstimadaEntrega),
      costoTotal: resumen?.costoTotal ?? null,
      valorCotizado: txt(o.valorCotizado),
      margenPct: resumen?.margenPct ?? null,
      alertas: resumen?.alertas ?? [],
      error,
    };
  });
  return f.conAlertas ? filas.filter((x) => x.alertas.length > 0 || x.error) : filas;
}
