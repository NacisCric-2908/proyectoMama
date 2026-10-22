"use server";

import { redirect } from "next/navigation";
import { datosDe, ejecutar, type ResultadoAccion } from "@/lib/acciones";
import { requerirPermiso } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import type { EstadoOrden } from "@/lib/costeo";
import { asignarCIF } from "@/lib/servicios/cif";
import { cambiarEstado } from "@/lib/servicios/estados";
import {
  eliminarConsumo,
  eliminarRegistroIngenieria,
  eliminarRegistroMOD,
  eliminarServicio,
  guardarConsumo,
  guardarRegistroIngenieria,
  guardarRegistroMOD,
  guardarServicio,
} from "@/lib/servicios/lineas";
import { actualizarOrden, crearOrden } from "@/lib/servicios/ordenes";
import { aprobarPresupuesto, crearVersionPresupuesto } from "@/lib/servicios/presupuestos";
import { registrarDevolucion, registrarRequisicion } from "@/lib/servicios/inventario";
import { guardarExplicacion } from "@/lib/servicios/desviaciones";
import { formatearPesos } from "@/lib/costeo";

const ruta = (id: string) => [`/ordenes/${id}`, "/ordenes", "/"];
const tx = <T,>(fn: (t: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>) =>
  prisma.$transaction(fn, { timeout: 20_000 });

export async function accionCrearOrden(_: ResultadoAccion | null, fd: FormData): Promise<ResultadoAccion> {
  let id: string | null = null;
  const r = await ejecutar(async () => {
    const u = await requerirPermiso("ordenes.editar");
    const orden = await tx((t) => crearOrden(t, u, datosDe(fd)));
    id = orden.id;
  });
  if (r.ok && id) redirect(`/ordenes/${id}`);
  return r;
}

export async function accionActualizarOrden(id: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("ordenes.editar");
    const datos = datosDe(fd);
    if (!("tecnicos" in datos)) datos.tecnicos = [];
    await tx((t) => actualizarOrden(t, u, id, datos));
  }, ruta(id));
}

export async function accionCambiarEstado(id: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("ordenes.cambiarEstado", "ordenes.cerrar", "ordenes.reabrir");
    const d = datosDe(fd) as Record<string, string>;
    await tx((t) =>
      cambiarEstado(t, u, id, d.estado as EstadoOrden, {
        comentario: d.comentario,
        numeroFactura: d.numeroFactura,
        fechaFactura: d.fechaFactura,
      }),
    );
    return { mensaje: "Estado actualizado" };
  }, ruta(id));
}

export async function accionGuardarConsumo(id: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("ordenes.editar");
    await tx((t) => guardarConsumo(t, u, id, datosDe(fd) as never));
  }, ruta(id));
}

export async function accionGuardarMOD(id: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("ordenes.editar", "horas.registrarPropias");
    await tx((t) => guardarRegistroMOD(t, u, id, datosDe(fd) as never));
  }, [...ruta(id), "/mis-horas"]);
}

export async function accionGuardarIngenieria(id: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("ordenes.editar", "horas.registrarPropias");
    const { advertencia } = await tx((t) => guardarRegistroIngenieria(t, u, id, datosDe(fd) as never));
    return { advertencia };
  }, [...ruta(id), "/mis-horas"]);
}

export async function accionGuardarServicio(id: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("ordenes.editar");
    await tx((t) => guardarServicio(t, u, id, datosDe(fd) as never));
  }, ruta(id));
}

export async function accionEliminarLinea(id: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("ordenes.editar", "horas.registrarPropias");
    const tipo = fd.get("tipo");
    const lineaId = String(fd.get("lineaId"));
    await tx(async (t) => {
      if (tipo === "material") await eliminarConsumo(t, u, id, lineaId);
      else if (tipo === "mod") await eliminarRegistroMOD(t, u, id, lineaId);
      else if (tipo === "ingenieria") await eliminarRegistroIngenieria(t, u, id, lineaId);
      else if (tipo === "servicio") await eliminarServicio(t, u, id, lineaId);
    });
    return { mensaje: "Registro eliminado" };
  }, [...ruta(id), "/mis-horas"]);
}

export async function accionAsignarCIF(id: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("cif.asignar");
    const d = datosDe(fd) as Record<string, string>;
    await tx((t) =>
      asignarCIF(t, u, id, {
        base: (d.base || undefined) as never,
        tasa: d.tasa || undefined,
        justificacion: d.justificacion || undefined,
      }),
    );
    return { mensaje: "CIF asignado" };
  }, ruta(id));
}

export async function accionCrearPresupuesto(id: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("ordenes.editar");
    const p = await tx((t) => crearVersionPresupuesto(t, u, id, datosDe(fd)));
    return { mensaje: `Versión ${p.version} del presupuesto registrada. Debe aprobarse para usarla en la comparación` };
  }, ruta(id));
}

export async function accionAprobarPresupuesto(id: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("presupuesto.aprobar");
    const p = await tx((t) => aprobarPresupuesto(t, u, id, String(fd.get("presupuestoId"))));
    return { mensaje: `Versión ${p.version} aprobada` };
  }, ruta(id));
}

export async function accionRequisicion(id: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("inventario.gestionar");
    const m = await tx((t) => registrarRequisicion(t, u, id, datosDe(fd)));
    return { mensaje: `Requisición registrada: salida valorada a ${formatearPesos(m.costoUnitario.toString())} por unidad (promedio ponderado)` };
  }, [...ruta(id), "/inventario"]);
}

export async function accionDevolucion(id: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("inventario.gestionar");
    await tx((t) => registrarDevolucion(t, u, id, datosDe(fd)));
    return { mensaje: "Devolución al almacén registrada" };
  }, [...ruta(id), "/inventario"]);
}

export async function accionExplicarDesviacion(id: string, _: ResultadoAccion | null, fd: FormData) {
  return ejecutar(async () => {
    const u = await requerirPermiso("ordenes.editar", "ordenes.cerrar");
    await tx((t) => guardarExplicacion(t, u, id, datosDe(fd)));
    return { mensaje: "Explicación registrada" };
  }, ruta(id));
}
