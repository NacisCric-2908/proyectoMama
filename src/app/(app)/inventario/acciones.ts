"use server";

import { datosDe, ejecutar, type ResultadoAccion } from "@/lib/acciones";
import { requerirPermiso } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { registrarAjuste, registrarEntrada } from "@/lib/servicios/inventario";

export async function accionEntrada(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("inventario.gestionar");
    await prisma.$transaction((t) => registrarEntrada(t, u, datosDe(fd)));
    return { mensaje: "Entrada registrada; el costo promedio se actualizó" };
  }, ["/inventario"]);
}

export async function accionAjuste(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("inventario.gestionar");
    await prisma.$transaction((t) => registrarAjuste(t, u, datosDe(fd)));
    return { mensaje: "Ajuste registrado" };
  }, ["/inventario"]);
}
