"use server";

import { datosDe, ejecutar, type ResultadoAccion } from "@/lib/acciones";
import { requerirPermiso } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { guardarEtapa, guardarParametros, guardarPermisosRol, guardarUsuario } from "@/lib/servicios/admin";
import { ErrorNegocio } from "@/lib/servicios/util";

export async function accionGuardarUsuario(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("usuarios.gestionar");
    await prisma.$transaction((t) => guardarUsuario(t, u, datosDe(fd)));
    return { mensaje: "Usuario guardado" };
  }, ["/admin"]);
}

export async function accionGuardarPermisos(rolId: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("usuarios.gestionar");
    const claves = (datosDe(fd).permisos as string[] | undefined) ?? [];
    await prisma.$transaction((t) => guardarPermisosRol(t, u, rolId, claves));
    return { mensaje: "Permisos actualizados" };
  }, ["/admin"]);
}

const LOGO_MAX = 300 * 1024;

export async function accionGuardarParametros(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("parametros.gestionar");
    let logo: string | null | undefined;
    const archivo = fd.get("logo");
    if (archivo instanceof File && archivo.size > 0) {
      if (!["image/png", "image/jpeg"].includes(archivo.type)) throw new ErrorNegocio("El logo debe ser PNG o JPG");
      if (archivo.size > LOGO_MAX) throw new ErrorNegocio("El logo no puede superar 300 KB");
      logo = `data:${archivo.type};base64,${Buffer.from(await archivo.arrayBuffer()).toString("base64")}`;
    }
    if (fd.get("quitarLogo") === "on") logo = null;
    await prisma.$transaction((t) => guardarParametros(t, u, datosDe(fd), logo));
    return { mensaje: "Parámetros guardados" };
  }, ["/admin", "/"]);
}

export async function accionGuardarEtapa(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("parametros.gestionar");
    await prisma.$transaction((t) => guardarEtapa(t, u, datosDe(fd)));
    return { mensaje: "Etapa guardada" };
  }, ["/admin"]);
}
