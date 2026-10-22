import { z } from "zod";
import { exigir, type UsuarioActual } from "@/lib/auth/permisos";
import { auditar } from "./auditoria";
import { aFechaDB, ErrorNegocio, type Tx } from "./util";

function validar<T extends z.ZodTypeAny>(esquema: T, datos: unknown): z.output<T> {
  const r = esquema.safeParse(datos);
  if (!r.success) throw new ErrorNegocio(r.error.issues[0].message, r.error.issues.map((i) => i.message));
  return r.data;
}
const opcional = z.string().trim().optional().nullable().transform((v) => v || null);
const activo = z.union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()]).optional().transform((v) => v === undefined ? true : v === true || v === "on" || v === "true");
const decimalNoNegativo = (campo: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => /^\d+(\.\d+)?$/.test(v), `${campo}: debe ser un número no negativo`);

// ───────────── Clientes ─────────────

export const esquemaCliente = z.object({
  id: z.string().optional(),
  nombre: z.string().trim().min(1, "Indique el nombre o razón social"),
  nit: opcional,
  contacto: opcional,
  telefono: opcional,
  correo: opcional.refine((v) => !v || /.+@.+\..+/.test(v), "Correo inválido"),
  ciudad: opcional,
  activo,
});

export async function guardarCliente(tx: Tx, u: UsuarioActual, entrada: unknown) {
  exigir(u, "clientes.gestionar");
  const { id, ...datos } = validar(esquemaCliente, entrada);
  const antes = id ? await tx.cliente.findUnique({ where: { id } }) : null;
  const c = antes ? await tx.cliente.update({ where: { id }, data: datos }) : await tx.cliente.create({ data: datos });
  await auditar(tx, u, "Cliente", c.id, antes, c, Object.keys(datos));
  return c;
}

// ───────────── Materiales ─────────────

export const CATEGORIAS_MATERIAL = ["PLC", "HMI", "Protecciones", "Cableado", "Gabinetes", "Borneras", "Variadores", "Instrumentación", "Accesorios", "Otros"];

export const esquemaMaterial = z.object({
  id: z.string().optional(),
  codigo: z.string().trim().min(1, "Indique el código"),
  descripcion: z.string().trim().min(1, "Indique la descripción"),
  unidad: z.string().trim().min(1, "Indique la unidad de medida"),
  categoria: z.string().trim().min(1, "Indique la categoría"),
  costoReferencia: decimalNoNegativo("Costo unitario"),
  activo,
});

export async function guardarMaterial(tx: Tx, u: UsuarioActual, entrada: unknown) {
  exigir(u, "materiales.gestionar");
  const { id, ...datos } = validar(esquemaMaterial, entrada);
  const duplicado = await tx.material.findUnique({ where: { codigo: datos.codigo } });
  if (duplicado && duplicado.id !== id) throw new ErrorNegocio(`Ya existe un material con el código ${datos.codigo}`);
  const antes = id ? await tx.material.findUnique({ where: { id } }) : null;
  const m = antes ? await tx.material.update({ where: { id }, data: datos }) : await tx.material.create({ data: datos });
  await auditar(tx, u, "Material", m.id, antes, m, Object.keys(datos));
  return m;
}

// ───────────── Trabajadores y tarifas ─────────────

export const esquemaTrabajador = z.object({
  id: z.string().optional(),
  nombre: z.string().trim().min(1, "Indique el nombre"),
  documento: opcional,
  cargo: z.string().trim().min(1, "Indique el cargo"),
  tipo: z.enum(["FABRICACION", "INGENIERIA", "AMBOS"]),
  activo,
});

export async function guardarTrabajador(tx: Tx, u: UsuarioActual, entrada: unknown) {
  exigir(u, "trabajadores.gestionar");
  const { id, ...datos } = validar(esquemaTrabajador, entrada);
  const antes = id ? await tx.trabajador.findUnique({ where: { id } }) : null;
  const t = antes ? await tx.trabajador.update({ where: { id }, data: datos }) : await tx.trabajador.create({ data: datos });
  await auditar(tx, u, "Trabajador", t.id, antes, t, Object.keys(datos));
  return t;
}

export const esquemaTarifa = z.object({
  trabajadorId: z.string().min(1),
  costoHora: decimalNoNegativo("Costo hora"),
  vigenteDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});

/**
 * Registra una nueva tarifa conservando el historial:
 * la tarifa abierta anterior se cierra el día antes de la nueva vigencia.
 */
export async function nuevaTarifa(tx: Tx, u: UsuarioActual, entrada: unknown) {
  exigir(u, "trabajadores.gestionar");
  const e = validar(esquemaTarifa, entrada);
  const desde = aFechaDB(e.vigenteDesde);
  const posterior = await tx.tarifaTrabajador.findFirst({ where: { trabajadorId: e.trabajadorId, vigenteDesde: { gte: desde } } });
  if (posterior) throw new ErrorNegocio("Ya existe una tarifa con vigencia igual o posterior a esa fecha");
  const abierta = await tx.tarifaTrabajador.findFirst({ where: { trabajadorId: e.trabajadorId, vigenteHasta: null } });
  if (abierta) {
    await tx.tarifaTrabajador.update({
      where: { id: abierta.id },
      data: { vigenteHasta: new Date(desde.getTime() - 86_400_000) },
    });
  }
  const t = await tx.tarifaTrabajador.create({ data: { trabajadorId: e.trabajadorId, costoHora: e.costoHora, vigenteDesde: desde } });
  await auditar(tx, u, "TarifaTrabajador", e.trabajadorId, abierta ? { costoHora: abierta.costoHora } : null, { costoHora: t.costoHora, vigenteDesde: t.vigenteDesde });
  return t;
}

/** Borrado lógico de catálogos. */
export async function eliminarCatalogo(tx: Tx, u: UsuarioActual, tipo: "cliente" | "material" | "trabajador", id: string) {
  const ahora = new Date();
  if (tipo === "cliente") {
    exigir(u, "clientes.gestionar");
    await tx.cliente.update({ where: { id }, data: { eliminadoEn: ahora, activo: false } });
  } else if (tipo === "material") {
    exigir(u, "materiales.gestionar");
    await tx.material.update({ where: { id }, data: { eliminadoEn: ahora, activo: false } });
  } else {
    exigir(u, "trabajadores.gestionar");
    await tx.trabajador.update({ where: { id }, data: { eliminadoEn: ahora, activo: false } });
  }
  await auditar(tx, u, tipo, id, { eliminado: "no" }, { eliminado: "sí" });
}
