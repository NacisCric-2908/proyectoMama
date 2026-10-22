import { Prisma } from "@prisma/client";
import {
  calcularResumenEstimado,
  ErrorCosteo,
  hoyBogota,
  NOMBRE_ESTADO,
  serializar,
  validarTransicion,
  type EstadoOrden,
} from "@/lib/costeo";
import { exigir, type UsuarioActual } from "@/lib/auth/permisos";
import { auditar } from "./auditoria";
import { asignarCIFAutomatico } from "./cif";
import {
  calcularResumenVivo,
  cargarOrden,
  entradaMotor,
  etapasCatalogo,
  exigirVerOrden,
  parametros,
  politicasDe,
  type SnapshotCierre,
} from "./ordenes";
import { aFechaDB, aISO, ErrorNegocio, type Tx } from "./util";

export interface OpcionesCambioEstado {
  comentario?: string | null;
  numeroFactura?: string | null;
  /** 'aaaa-mm-dd' */
  fechaFactura?: string | null;
}

/** Verificaciones previas al cierre (§7). Devuelve la lista de problemas. */
export function verificarCierre(o: Awaited<ReturnType<typeof cargarOrden>>): string[] {
  const problemas: string[] = [];
  if (o.materiales.length === 0 && o.registrosMOD.length === 0 && o.registrosIng.length === 0)
    problemas.push("Debe existir al menos un material o un registro de horas");
  if (!o.asignacionCIF) problemas.push("El CIF no está asignado");
  return problemas;
}

export async function cambiarEstado(
  tx: Tx,
  u: UsuarioActual,
  ordenId: string,
  nuevo: EstadoOrden,
  opciones: OpcionesCambioEstado = {},
) {
  exigir(u, "ordenes.cambiarEstado", "ordenes.cerrar", "ordenes.reabrir");
  let orden = await cargarOrden(tx, ordenId);
  exigirVerOrden(u, orden);
  const actual = orden.estado as EstadoOrden;
  const comentario = opciones.comentario?.trim() || null;

  const v = validarTransicion(actual, nuevo, {
    comentario,
    // el permiso de reapertura se verifica abajo con exigir() para devolver ErrorPermiso
    puedeReabrir: true,
    datos: {
      clienteId: orden.clienteId,
      descripcion: orden.descripcion,
      fechaEstimadaEntrega: aISO(orden.fechaEstimadaEntrega),
      valorCotizado: orden.valorCotizado?.toString() ?? null,
    },
  });
  if (!v.ok) throw new ErrorNegocio(v.error, v.faltantes);

  if (v.tipo === "cierre" || v.tipo === "facturacion") exigir(u, "ordenes.cerrar");
  else if (v.tipo === "reapertura") {
    exigir(u, "ordenes.reabrir");
    const conciliada = orden.ajustesCIF[0]?.conciliacion;
    if (conciliada)
      throw new ErrorNegocio(
        `El CIF del período ${conciliada.periodo} ya está conciliado con esta orden. Anule primero la conciliación para reabrirla`,
      );
  }
  else if (v.tipo === "retroceso" && actual === "FACTURADO") exigir(u, "ordenes.cerrar");
  else exigir(u, "ordenes.cambiarEstado");

  const datos: Prisma.OrdenProyectoUpdateInput = { estado: nuevo, modificadoPorId: u.id };

  // Activación: guardar la estimación al cotizar y asignar CIF si aún no tiene.
  if (actual === "BORRADOR") {
    if (!orden.asignacionCIF) {
      await asignarCIFAutomatico(tx, u, ordenId);
      orden = await cargarOrden(tx, ordenId);
    }
    if (!orden.estimadoAlCotizar) {
      const [etapas, p] = await Promise.all([etapasCatalogo(tx), parametros(tx)]);
      try {
        const estimado = calcularResumenEstimado(entradaMotor(orden, etapas, politicasDe(p)));
        datos.estimadoAlCotizar = serializar(estimado) as unknown as Prisma.InputJsonValue;
      } catch (e) {
        if (e instanceof ErrorCosteo) throw new ErrorNegocio(e.message);
        throw e;
      }
    }
  }

  if (v.tipo === "cierre") {
    const problemas = verificarCierre(orden);
    let resumen;
    try {
      resumen = await calcularResumenVivo(tx, { ...orden, estado: "TERMINADO" });
    } catch (e) {
      if (e instanceof ErrorCosteo) problemas.push(e.message);
      else throw e;
    }
    if (problemas.length || !resumen)
      throw new ErrorNegocio(`No se puede cerrar la orden: ${problemas.join("; ")}`, problemas);

    const cerradoEn = new Date();
    const snapshot: SnapshotCierre = { resumen: serializar(resumen), cerradoEn: cerradoEn.toISOString(), cerradoPor: u.nombre };
    datos.snapshotCierre = snapshot as unknown as Prisma.InputJsonValue;
    datos.cerradoPorId = u.id;
    datos.cerradoEn = cerradoEn;
    datos.fechaTerminacion = orden.fechaTerminacion ?? aFechaDB(hoyBogota());
    if (resumen.cif) {
      await tx.asignacionCIF.update({
        where: { ordenId },
        data: { cantidadBase: resumen.cif.cantidadBase.toString(), valorAsignado: resumen.cif.valor.toString() },
      });
    }
  }

  if (v.tipo === "facturacion") {
    if (!opciones.numeroFactura?.trim() || !opciones.fechaFactura)
      throw new ErrorNegocio("Indique el número y la fecha de la factura");
    datos.numeroFactura = opciones.numeroFactura.trim();
    datos.fechaFactura = aFechaDB(opciones.fechaFactura);
  }

  if (actual === "FACTURADO" && nuevo === "TERMINADO") {
    datos.numeroFactura = null;
    datos.fechaFactura = null;
  }

  if (v.tipo === "reapertura") {
    datos.snapshotCierre = Prisma.DbNull;
    datos.cerradoEn = null;
    datos.cerradoPorId = null;
    datos.fechaTerminacion = null;
  }

  const actualizada = await tx.ordenProyecto.update({
    where: { id: ordenId },
    data: datos,
  });

  await tx.historialEstado.create({
    data: { ordenId, estadoAnterior: actual, estadoNuevo: nuevo, comentario, usuarioId: u.id, usuarioNombre: u.nombre },
  });
  await auditar(
    tx,
    u,
    "OrdenProyecto",
    ordenId,
    { estado: NOMBRE_ESTADO[actual], numeroFactura: orden.numeroFactura },
    { estado: NOMBRE_ESTADO[nuevo], numeroFactura: actualizada.numeroFactura, ...(v.tipo === "reapertura" ? { reapertura: comentario } : {}) },
  );
  return actualizada;
}
