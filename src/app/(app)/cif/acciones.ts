"use server";

import { datosDe, ejecutar, type ResultadoAccion } from "@/lib/acciones";
import { requerirPermiso } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { guardarParametroCIF } from "@/lib/servicios/cif";
import { agregarConceptoCIFReal, anularConciliacion, conciliarPeriodo, eliminarConceptoCIFReal } from "@/lib/servicios/conciliacion";
import type { PoliticaAjusteCIF } from "@/lib/costeo";

export async function accionGuardarParametroCIF(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("cif.configurar");
    await prisma.$transaction((t) => guardarParametroCIF(t, u, datosDe(fd) as never));
    return { mensaje: "Parámetro de CIF guardado. Las órdenes abiertas del período mostrarán el aviso para recalcular." };
  }, ["/cif", "/ordenes"]);
}

export async function accionAgregarConceptoCIF(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("cif.conciliar");
    await prisma.$transaction((t) => agregarConceptoCIFReal(t, u, datosDe(fd)));
    return { mensaje: "Concepto de CIF real registrado" };
  }, ["/cif"]);
}

export async function accionEliminarConceptoCIF(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("cif.conciliar");
    await prisma.$transaction((t) => eliminarConceptoCIFReal(t, u, String(fd.get("id"))));
    return { mensaje: "Concepto eliminado" };
  }, ["/cif"]);
}

export async function accionConciliar(periodo: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("cif.conciliar");
    const politica = String(fd.get("politica")) as PoliticaAjusteCIF;
    await prisma.$transaction((t) => conciliarPeriodo(t, u, periodo, politica, String(fd.get("observaciones") ?? "")), { timeout: 20_000 });
    return { mensaje: "Período conciliado. El costo ajustado quedó registrado en cada orden" };
  }, ["/cif", "/ordenes"]);
}

export async function accionAnularConciliacion(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("cif.conciliar");
    await prisma.$transaction((t) => anularConciliacion(t, u, String(fd.get("id")), String(fd.get("motivo") ?? "")));
    return { mensaje: "Conciliación anulada" };
  }, ["/cif", "/ordenes"]);
}
