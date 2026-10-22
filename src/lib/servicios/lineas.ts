import { z } from "zod";
import {
  calcularLineaMaterial,
  calcularRegistroMOD,
  validarRegistroIngenieria,
  ErrorCosteo,
} from "@/lib/costeo";
import { exigir, ErrorPermiso, tiene, type UsuarioActual } from "@/lib/auth/permisos";
import { auditar } from "./auditoria";
import { exigirEditable, exigirVerOrden } from "./ordenes";
import { tarifaVigente } from "./tarifas";
import { aFechaDB, ErrorNegocio, txt, type Tx } from "./util";

const num = (requerido: boolean) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((v) => (v === undefined || v === null || v === "" ? null : String(v).trim().replace(",", ".")))
    .refine((v) => (requerido ? v !== null : true), "Campo obligatorio")
    .refine((v) => v === null || /^-?\d+(\.\d+)?$/.test(v), "Debe ser un número válido");

const texto = z.string().trim().optional().nullable().transform((v) => v || null);

function validar<T extends z.ZodTypeAny>(esquema: T, datos: unknown): z.output<T> {
  const r = esquema.safeParse(datos);
  if (!r.success) {
    const errores = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new ErrorNegocio(r.error.issues[0].message, errores);
  }
  return r.data;
}

/** Ejecuta la validación del motor y convierte su error en ErrorNegocio. */
function motor<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof ErrorCosteo) throw new ErrorNegocio(e.message);
    throw e;
  }
}

async function ordenParaEditar(tx: Tx, u: UsuarioActual, ordenId: string) {
  const orden = await tx.ordenProyecto.findFirst({ where: { id: ordenId, eliminadoEn: null }, include: { tecnicos: true } });
  if (!orden) throw new ErrorNegocio("La orden no existe");
  exigirVerOrden(u, orden);
  exigirEditable(orden);
  return orden;
}

// ───────────── Materiales ─────────────

export const esquemaConsumo = z.object({
  id: z.string().optional(),
  materialId: z.string().min(1, "Seleccione un material"),
  etapaId: texto,
  cantidadRequerida: num(false),
  cantidadEntregada: num(false),
  cantidadUtilizada: num(false),
  cantidadDevuelta: num(false),
  causaMerma: texto,
  costoUnitario: num(false),
  clasificacionMerma: z
    .enum(["NORMAL", "ANORMAL", "RECUPERABLE", ""])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  disposicionMerma: texto,
  valorRecuperado: num(false),
});

export async function guardarConsumo(tx: Tx, u: UsuarioActual, ordenId: string, entrada: z.input<typeof esquemaConsumo>) {
  exigir(u, "ordenes.editar");
  await ordenParaEditar(tx, u, ordenId);
  const e = validar(esquemaConsumo, entrada);
  const material = await tx.material.findUnique({ where: { id: e.materialId } });
  if (!material) throw new ErrorNegocio("El material no existe");

  const antes = e.id
    ? await tx.consumoMaterial.findFirst({ where: { id: e.id, ordenId, eliminadoEn: null }, include: { _count: { select: { movimientos: true } } } })
    : null;
  if (e.id && !antes) throw new ErrorNegocio("La línea de material no existe");
  // En las líneas alimentadas por el kárdex, entregada, devuelta y costo provienen de los movimientos.
  const kardex = !!antes && antes._count.movimientos > 0;
  if (kardex && e.materialId !== antes!.materialId) throw new ErrorNegocio("No se puede cambiar el material de una línea con movimientos de inventario");

  // El costo unitario se copia del catálogo al crear la línea; luego solo cambia si se edita explícitamente.
  const costoUnitario = kardex
    ? antes!.costoUnitarioAplicado.toString()
    : e.costoUnitario ?? antes?.costoUnitarioAplicado.toString() ?? material.costoReferencia.toString();
  const datos = {
    materialId: e.materialId,
    etapaId: e.etapaId,
    cantidadRequerida: e.cantidadRequerida ?? "0",
    cantidadEntregada: kardex ? txt(antes!.cantidadEntregada) : e.cantidadEntregada,
    cantidadUtilizada: e.cantidadUtilizada ?? "0",
    cantidadDevuelta: kardex ? antes!.cantidadDevuelta.toString() : e.cantidadDevuelta ?? "0",
    causaMerma: e.causaMerma,
    clasificacionMerma: e.clasificacionMerma,
    disposicionMerma: e.disposicionMerma,
    valorRecuperado: e.valorRecuperado ?? "0",
    costoUnitarioAplicado: costoUnitario,
  };
  motor(() =>
    calcularLineaMaterial({
      descripcion: material.descripcion,
      requerida: datos.cantidadRequerida,
      entregada: datos.cantidadEntregada,
      utilizada: datos.cantidadUtilizada,
      devuelta: datos.cantidadDevuelta,
      costoUnitario,
      clasificacionMerma: datos.clasificacionMerma,
      valorRecuperado: datos.valorRecuperado,
    }),
  );

  const linea = antes
    ? await tx.consumoMaterial.update({ where: { id: antes.id }, data: datos })
    : await tx.consumoMaterial.create({ data: { ordenId, ...datos } });
  await auditar(tx, u, "ConsumoMaterial", linea.id, antes, linea, Object.keys(datos));
  return linea;
}

export async function eliminarConsumo(tx: Tx, u: UsuarioActual, ordenId: string, id: string) {
  exigir(u, "ordenes.editar");
  await ordenParaEditar(tx, u, ordenId);
  const antes = await tx.consumoMaterial.findFirst({ where: { id, ordenId, eliminadoEn: null }, include: { _count: { select: { movimientos: true } } } });
  if (!antes) throw new ErrorNegocio("La línea de material no existe");
  if (antes._count.movimientos > 0)
    throw new ErrorNegocio("La línea tiene movimientos de inventario. Registre la devolución al almacén en lugar de eliminarla");
  await tx.consumoMaterial.update({ where: { id }, data: { eliminadoEn: new Date() } });
  await auditar(tx, u, "ConsumoMaterial", id, antes, null, ["materialId", "cantidadUtilizada", "costoUnitarioAplicado"]);
}

// ───────────── Horas (MOD e ingeniería) ─────────────

/**
 * Reglas comunes de registro de horas:
 * - con `ordenes.editar` se registra para cualquier trabajador;
 * - con `horas.registrarPropias` solo para sí mismo y en órdenes asignadas;
 * - la tarifa se toma de la vigente en la fecha salvo que el usuario pueda editarla.
 */
async function resolverHoras(
  tx: Tx,
  u: UsuarioActual,
  ordenId: string,
  trabajadorId: string | null,
  fecha: string,
  tarifaIngresada: string | null,
  creadoPorAnterior: { trabajadorId: string | null } | null,
) {
  const orden = await ordenParaEditar(tx, u, ordenId);
  const puedeTodo = tiene(u, "ordenes.editar");
  if (!puedeTodo) {
    exigir(u, "horas.registrarPropias");
    if (!u.trabajadorId || trabajadorId !== u.trabajadorId)
      throw new ErrorPermiso("Solo puede registrar sus propias horas");
    if (!orden.tecnicos.some((t) => t.trabajadorId === u.trabajadorId))
      throw new ErrorPermiso("No está asignado a esta orden");
    if (creadoPorAnterior && creadoPorAnterior.trabajadorId !== u.trabajadorId)
      throw new ErrorPermiso("Solo puede editar sus propias horas");
  }
  const vigente = trabajadorId ? await tarifaVigente(tx, trabajadorId, fecha) : null;
  const puedeEditarTarifa = tiene(u, "tarifas.editarEnRegistro");
  const tarifa = puedeEditarTarifa && tarifaIngresada !== null ? tarifaIngresada : vigente;
  if (tarifa === null)
    throw new ErrorNegocio(
      trabajadorId ? "El trabajador no tiene una tarifa vigente en esa fecha" : "Debe indicar la tarifa por hora",
    );
  return tarifa;
}

export const esquemaMOD = z.object({
  id: z.string().optional(),
  trabajadorId: texto,
  cargo: texto,
  actividad: z.string().trim().min(1, "Indique la actividad realizada"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  horas: num(true),
  tarifa: num(false),
});

export async function guardarRegistroMOD(tx: Tx, u: UsuarioActual, ordenId: string, entrada: z.input<typeof esquemaMOD>) {
  const e = validar(esquemaMOD, entrada);
  if (!e.trabajadorId && !e.cargo) throw new ErrorNegocio("Indique el trabajador o el cargo");
  const antes = e.id ? await tx.registroMOD.findFirst({ where: { id: e.id, ordenId, eliminadoEn: null } }) : null;
  if (e.id && !antes) throw new ErrorNegocio("El registro no existe");
  const tarifa = await resolverHoras(tx, u, ordenId, e.trabajadorId, e.fecha, e.tarifa, antes);
  motor(() => calcularRegistroMOD({ horas: e.horas!, tarifa }));

  const datos = {
    trabajadorId: e.trabajadorId,
    cargo: e.cargo,
    actividad: e.actividad,
    fecha: aFechaDB(e.fecha),
    horas: e.horas!,
    tarifaAplicada: tarifa,
  };
  const r = antes
    ? await tx.registroMOD.update({ where: { id: antes.id }, data: datos })
    : await tx.registroMOD.create({ data: { ordenId, creadoPorId: u.id, ...datos } });
  await auditar(tx, u, "RegistroMOD", r.id, antes, r, Object.keys(datos));
  return r;
}

export const esquemaIngenieria = z.object({
  id: z.string().optional(),
  etapaId: z.string().min(1, "Seleccione la etapa"),
  responsableId: z.string().min(1, "Seleccione el responsable"),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de inicio inválida"),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de finalización inválida"),
  horas: num(true),
  costoHora: num(false),
  descripcion: z.string().trim().min(1, "Describa la actividad"),
  observacionesTecnicas: texto,
});

/** Devuelve el registro y, si aplica, una advertencia que no bloquea el guardado. */
export async function guardarRegistroIngenieria(
  tx: Tx,
  u: UsuarioActual,
  ordenId: string,
  entrada: z.input<typeof esquemaIngenieria>,
) {
  const e = validar(esquemaIngenieria, entrada);
  const antes = e.id ? await tx.registroIngenieria.findFirst({ where: { id: e.id, ordenId, eliminadoEn: null } }) : null;
  if (e.id && !antes) throw new ErrorNegocio("El registro no existe");
  const costoHora = await resolverHoras(
    tx,
    u,
    ordenId,
    e.responsableId,
    e.fechaInicio,
    e.costoHora,
    antes ? { trabajadorId: antes.responsableId } : null,
  );
  const advertencia = motor(() =>
    validarRegistroIngenieria({ etapaId: e.etapaId, horas: e.horas!, costoHora, fechaInicio: e.fechaInicio, fechaFin: e.fechaFin }),
  );
  const datos = {
    etapaId: e.etapaId,
    responsableId: e.responsableId,
    fechaInicio: aFechaDB(e.fechaInicio),
    fechaFin: aFechaDB(e.fechaFin),
    horas: e.horas!,
    costoHoraAplicado: costoHora,
    descripcion: e.descripcion,
    observacionesTecnicas: e.observacionesTecnicas,
  };
  const r = antes
    ? await tx.registroIngenieria.update({ where: { id: antes.id }, data: datos })
    : await tx.registroIngenieria.create({ data: { ordenId, creadoPorId: u.id, ...datos } });
  await auditar(tx, u, "RegistroIngenieria", r.id, antes, r, Object.keys(datos));
  return { registro: r, advertencia };
}

async function eliminarHoras(
  tx: Tx,
  u: UsuarioActual,
  ordenId: string,
  tipo: "MOD" | "ING",
  id: string,
) {
  const orden = await ordenParaEditar(tx, u, ordenId);
  const antes =
    tipo === "MOD"
      ? await tx.registroMOD.findFirst({ where: { id, ordenId, eliminadoEn: null } })
      : await tx.registroIngenieria.findFirst({ where: { id, ordenId, eliminadoEn: null } });
  if (!antes) throw new ErrorNegocio("El registro no existe");
  if (!tiene(u, "ordenes.editar")) {
    exigir(u, "horas.registrarPropias");
    const dueno = "trabajadorId" in antes ? antes.trabajadorId : antes.responsableId;
    if (!u.trabajadorId || dueno !== u.trabajadorId || !orden.tecnicos.some((t) => t.trabajadorId === u.trabajadorId))
      throw new ErrorPermiso("Solo puede eliminar sus propias horas");
  }
  if (tipo === "MOD") await tx.registroMOD.update({ where: { id }, data: { eliminadoEn: new Date() } });
  else await tx.registroIngenieria.update({ where: { id }, data: { eliminadoEn: new Date() } });
  await auditar(tx, u, tipo === "MOD" ? "RegistroMOD" : "RegistroIngenieria", id, antes, null, ["horas"]);
}

export const eliminarRegistroMOD = (tx: Tx, u: UsuarioActual, ordenId: string, id: string) =>
  eliminarHoras(tx, u, ordenId, "MOD", id);
export const eliminarRegistroIngenieria = (tx: Tx, u: UsuarioActual, ordenId: string, id: string) =>
  eliminarHoras(tx, u, ordenId, "ING", id);

// ───────────── Servicios adicionales por etapa ─────────────

export const esquemaServicio = z.object({
  id: z.string().optional(),
  etapaId: z.string().min(1, "Seleccione la etapa"),
  descripcion: z.string().trim().min(1, "Describa el servicio"),
  valor: num(true).refine((v) => v === null || Number(v) >= 0, "No se permiten valores negativos"),
});

export async function guardarServicio(tx: Tx, u: UsuarioActual, ordenId: string, entrada: z.input<typeof esquemaServicio>) {
  exigir(u, "ordenes.editar");
  await ordenParaEditar(tx, u, ordenId);
  const e = validar(esquemaServicio, entrada);
  const antes = e.id ? await tx.servicioAdicionalEtapa.findFirst({ where: { id: e.id, ordenId, eliminadoEn: null } }) : null;
  const datos = { etapaId: e.etapaId, descripcion: e.descripcion, valor: e.valor! };
  const s = antes
    ? await tx.servicioAdicionalEtapa.update({ where: { id: antes.id }, data: datos })
    : await tx.servicioAdicionalEtapa.create({ data: { ordenId, ...datos } });
  await auditar(tx, u, "ServicioAdicionalEtapa", s.id, antes, s, Object.keys(datos));
  return s;
}

export async function eliminarServicio(tx: Tx, u: UsuarioActual, ordenId: string, id: string) {
  exigir(u, "ordenes.editar");
  await ordenParaEditar(tx, u, ordenId);
  const antes = await tx.servicioAdicionalEtapa.findFirst({ where: { id, ordenId, eliminadoEn: null } });
  if (!antes) throw new ErrorNegocio("El servicio no existe");
  await tx.servicioAdicionalEtapa.update({ where: { id }, data: { eliminadoEn: new Date() } });
  await auditar(tx, u, "ServicioAdicionalEtapa", id, antes, null, ["valor"]);
}
