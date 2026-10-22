"use server";

import { datosDe, ejecutar, type ResultadoAccion } from "@/lib/acciones";
import { requerirPermiso } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { guardarParametroCIF } from "@/lib/servicios/cif";

export async function accionGuardarParametroCIF(_: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("cif.configurar");
    await prisma.$transaction((t) => guardarParametroCIF(t, u, datosDe(fd) as never));
    return { mensaje: "Parámetro de CIF guardado. Las órdenes abiertas del período mostrarán el aviso para recalcular." };
  }, ["/cif", "/ordenes"]);
}
