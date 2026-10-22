import { z } from "zod";
import { compararConPresupuesto, CONCEPTOS } from "@/lib/costeo";
import { exigir, type UsuarioActual } from "@/lib/auth/permisos";
import { auditar } from "./auditoria";
import { cargarOrden, exigirVerOrden, resumenOrden } from "./ordenes";
import { componentesDe } from "./presupuestos";
import { ErrorNegocio, type Tx } from "./util";

export const CAUSAS_DESVIACION = {
  PRECIO_MATERIALES: "Precio de los materiales",
  CANTIDAD_MATERIALES: "Cantidad de materiales (consumo o mermas)",
  HORAS: "Horas de trabajo",
  TARIFAS: "Tarifas por hora",
  CAMBIO_CLIENTE: "Cambio solicitado por el cliente",
  METODO_ESTIMACION: "Método de estimación del presupuesto",
  CIF: "Costos indirectos (tasa o base)",
  OTRA: "Otra",
} as const;

const COMPONENTES = [...CONCEPTOS.map((c) => c.clave), "total"] as const;

export const esquemaExplicacion = z.object({
  presupuestoId: z.string().min(1),
  componente: z.enum(COMPONENTES as unknown as [string, ...string[]]),
  causa: z.enum(Object.keys(CAUSAS_DESVIACION) as [keyof typeof CAUSAS_DESVIACION, ...(keyof typeof CAUSAS_DESVIACION)[]]),
  explicacion: z.string().trim().min(10, "Escriba una explicación de al menos 10 caracteres"),
  soporte: z.string().trim().optional().nullable().transform((v) => v || null),
});

/**
 * Documenta la explicación de la diferencia de un componente frente a una versión aprobada del presupuesto.
 * Se puede registrar también con la orden cerrada (es documentación, no cambia costos).
 */
export async function guardarExplicacion(tx: Tx, u: UsuarioActual, ordenId: string, entrada: unknown) {
  exigir(u, "ordenes.editar", "ordenes.cerrar");
  const r = esquemaExplicacion.safeParse(entrada);
  if (!r.success) throw new ErrorNegocio(r.error.issues[0].message);
  const e = r.data;
  const orden = await cargarOrden(tx, ordenId);
  exigirVerOrden(u, orden);
  const presupuesto = orden.presupuestos.find((p) => p.id === e.presupuestoId);
  if (!presupuesto?.aprobadoEn) throw new ErrorNegocio("Solo se explican diferencias frente a una versión aprobada del presupuesto");

  const resumen = await resumenOrden(tx, orden);
  const c = compararConPresupuesto(componentesDe(presupuesto), {
    elementos: resumen.elementos,
    costoTotal: resumen.costoTotal,
    horasMOD: resumen.mod.horasMOD,
    horasIngenieria: resumen.ingenieria.horasIngenieria,
  });
  const fila = e.componente === "total" ? c.total : c.filas.find((f) => f.clave === e.componente)!;

  const antes = await tx.explicacionDesviacion.findUnique({ where: { presupuestoId_componente: { presupuestoId: e.presupuestoId, componente: e.componente } } });
  const datos = {
    causa: e.causa,
    explicacion: e.explicacion,
    soporte: e.soporte,
    diferencia: fila.diferencia.toString(),
    usuarioId: u.id,
    usuarioNombre: u.nombre,
    fecha: new Date(),
  };
  const guardada = await tx.explicacionDesviacion.upsert({
    where: { presupuestoId_componente: { presupuestoId: e.presupuestoId, componente: e.componente } },
    create: { ordenId, presupuestoId: e.presupuestoId, componente: e.componente, ...datos },
    update: datos,
  });
  await auditar(tx, u, "ExplicacionDesviacion", ordenId, antes, guardada, ["componente", "causa", "explicacion", "diferencia", "soporte"]);
  return guardada;
}
