"use server";

import { datosDe, ejecutar, type ResultadoAccion } from "@/lib/acciones";
import { requerirPermiso } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { eliminarCatalogo, guardarCliente, guardarMaterial, guardarTrabajador, nuevaTarifa } from "@/lib/servicios/catalogos";

const rutas = ["/clientes", "/materiales", "/trabajadores", "/ordenes"];

export async function accionGuardarCliente(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("clientes.gestionar");
    await prisma.$transaction((t) => guardarCliente(t, u, datosDe(fd)));
    return { mensaje: "Cliente guardado" };
  }, rutas);
}

export async function accionGuardarMaterial(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("materiales.gestionar");
    await prisma.$transaction((t) => guardarMaterial(t, u, datosDe(fd)));
    return { mensaje: "Material guardado" };
  }, rutas);
}

export async function accionGuardarTrabajador(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("trabajadores.gestionar");
    await prisma.$transaction((t) => guardarTrabajador(t, u, datosDe(fd)));
    return { mensaje: "Trabajador guardado" };
  }, rutas);
}

export async function accionNuevaTarifa(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("trabajadores.gestionar");
    await prisma.$transaction((t) => nuevaTarifa(t, u, datosDe(fd)));
    return { mensaje: "Tarifa registrada" };
  }, rutas);
}

export async function accionEliminarCatalogo(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("clientes.gestionar", "materiales.gestionar", "trabajadores.gestionar");
    const tipo = String(fd.get("tipo")) as "cliente" | "material" | "trabajador";
    await prisma.$transaction((t) => eliminarCatalogo(t, u, tipo, String(fd.get("id"))));
    return { mensaje: "Registro eliminado" };
  }, rutas);
}
