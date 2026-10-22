import bcrypt from "bcryptjs";
import { z } from "zod";
import { exigir, PERMISOS, type ClavePermiso, type UsuarioActual } from "@/lib/auth/permisos";
import { auditar } from "./auditoria";
import { ErrorNegocio, type Tx } from "./util";

function validar<T extends z.ZodTypeAny>(esquema: T, datos: unknown): z.output<T> {
  const r = esquema.safeParse(datos);
  if (!r.success) throw new ErrorNegocio(r.error.issues[0].message);
  return r.data;
}

export const esquemaUsuario = z.object({
  id: z.string().optional(),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  nombre: z.string().trim().min(1, "Indique el nombre"),
  rolId: z.string().min(1, "Seleccione el rol"),
  trabajadorId: z.string().optional().transform((v) => v || null),
  contrasena: z.string().optional().transform((v) => v || null),
  activo: z.string().optional().transform((v) => v !== "false"),
});

export async function guardarUsuario(tx: Tx, u: UsuarioActual, entrada: unknown) {
  exigir(u, "usuarios.gestionar");
  const { id, contrasena, ...datos } = validar(esquemaUsuario, entrada);
  if (contrasena !== null && contrasena.length < 8) throw new ErrorNegocio("La contraseña debe tener al menos 8 caracteres");
  if (!id && !contrasena) throw new ErrorNegocio("Indique una contraseña para el nuevo usuario");
  if (id === u.id && !datos.activo) throw new ErrorNegocio("No puede desactivar su propio usuario");
  const hash = contrasena ? await bcrypt.hash(contrasena, 10) : undefined;
  const antes = id ? await tx.usuario.findUnique({ where: { id } }) : null;
  const nuevo = antes
    ? await tx.usuario.update({ where: { id }, data: { ...datos, ...(hash ? { hashContrasena: hash } : {}) } })
    : await tx.usuario.create({ data: { ...datos, hashContrasena: hash! } });
  await auditar(tx, u, "Usuario", nuevo.id, antes, nuevo, ["email", "nombre", "rolId", "trabajadorId", "activo"]);
  if (hash) await auditar(tx, u, "Usuario", nuevo.id, { contrasena: "—" }, { contrasena: "cambiada" });
  return nuevo;
}

/** Reemplaza la matriz de permisos de un rol. El rol Administrador conserva siempre todos. */
export async function guardarPermisosRol(tx: Tx, u: UsuarioActual, rolId: string, claves: string[]) {
  exigir(u, "usuarios.gestionar");
  const rol = await tx.rol.findUniqueOrThrow({ where: { id: rolId }, include: { permisos: true } });
  if (rol.clave === "ADMINISTRADOR") throw new ErrorNegocio("Los permisos del Administrador no se pueden modificar");
  const validas = claves.filter((c): c is ClavePermiso => c in PERMISOS);
  await tx.permiso.deleteMany({ where: { rolId } });
  if (validas.length) await tx.permiso.createMany({ data: validas.map((clave) => ({ rolId, clave })) });
  await auditar(tx, u, "Rol", rolId, { permisos: rol.permisos.map((p) => p.clave).sort().join(", ") }, { permisos: validas.sort().join(", ") });
}

export const esquemaParametros = z.object({
  nombreEmpresa: z.string().trim().min(1, "Indique el nombre de la empresa"),
  margenMinimoGlobal: z.string().trim().transform((v) => v.replace(",", ".")).refine((v) => /^\d+(\.\d+)?$/.test(v) && Number(v) < 100, "Margen mínimo inválido"),
  formatoCodigoOrden: z.string().trim().refine((v) => /\{N+\}/.test(v), "El formato debe incluir el consecutivo, por ejemplo {NNNN}"),
  baseCifDefecto: z.enum(["HORAS_MOD", "HORAS_TOTALES", "COSTO_MOD", "COSTO_DIRECTO", "NUMERO_PROYECTOS"]),
  umbralMermaPct: z.string().trim().transform((v) => v.replace(",", ".")).refine((v) => /^\d+(\.\d+)?$/.test(v), "Umbral inválido"),
});

export async function guardarParametros(tx: Tx, u: UsuarioActual, entrada: unknown, logo?: string | null) {
  exigir(u, "parametros.gestionar");
  const datos = validar(esquemaParametros, entrada);
  const antes = await tx.parametrosGenerales.findUnique({ where: { id: 1 } });
  const p = await tx.parametrosGenerales.update({ where: { id: 1 }, data: { ...datos, ...(logo !== undefined ? { logo } : {}) } });
  await auditar(tx, u, "ParametrosGenerales", "1", antes, p, Object.keys(datos));
  return p;
}

export const esquemaEtapa = z.object({
  id: z.string().optional(),
  nombre: z.string().trim().min(1, "Indique el nombre"),
  grupo: z.enum(["INGENIERIA_AUTOMATIZACION", "PRUEBAS_PUESTA_MARCHA"]),
  orden: z.coerce.number().int(),
  activa: z.string().optional().transform((v) => v !== "false"),
});

export async function guardarEtapa(tx: Tx, u: UsuarioActual, entrada: unknown) {
  exigir(u, "parametros.gestionar");
  const { id, ...datos } = validar(esquemaEtapa, entrada);
  const antes = id ? await tx.etapa.findUnique({ where: { id } }) : null;
  const e = antes ? await tx.etapa.update({ where: { id }, data: datos }) : await tx.etapa.create({ data: datos });
  await auditar(tx, u, "Etapa", e.id, antes, e, Object.keys(datos));
  return e;
}
