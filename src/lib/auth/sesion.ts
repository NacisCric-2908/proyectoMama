import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "./index";
import { ErrorPermiso, tiene, type ClavePermiso, type ClaveRol, type UsuarioActual } from "./permisos";

export { ErrorPermiso, tiene, type UsuarioActual };

/** Usuario de la sesión con sus permisos leídos de la BD (una vez por petición). */
export const obtenerUsuario = cache(async (): Promise<UsuarioActual | null> => {
  const sesion = await auth();
  const id = sesion?.user?.id;
  if (!id) return null;
  const u = await prisma.usuario.findUnique({ where: { id }, include: { rol: { include: { permisos: true } } } });
  if (!u || !u.activo) return null;
  const rol = u.rol.clave as ClaveRol;
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol,
    rolNombre: u.rol.nombre,
    trabajadorId: u.trabajadorId,
    permisos: new Set(u.rol.permisos.map((p) => p.clave as ClavePermiso)),
  };
});

/** Para páginas: redirige al login si no hay sesión. */
export async function requerirSesion(): Promise<UsuarioActual> {
  const u = await obtenerUsuario();
  if (!u) redirect("/login");
  return u;
}

/** Para acciones y páginas: lanza ErrorPermiso si el usuario no tiene alguno de los permisos. */
export async function requerirPermiso(...permisos: ClavePermiso[]): Promise<UsuarioActual> {
  const u = await obtenerUsuario();
  if (!u) throw new ErrorPermiso("La sesión expiró. Inicie sesión de nuevo");
  if (!permisos.some((p) => tiene(u, p))) throw new ErrorPermiso();
  return u;
}

/** Para páginas: redirige a /sin-permiso en lugar de lanzar error. */
export async function requerirPagina(...permisos: ClavePermiso[]): Promise<UsuarioActual> {
  const u = await requerirSesion();
  if (!permisos.some((p) => tiene(u, p))) redirect("/sin-permiso");
  return u;
}
