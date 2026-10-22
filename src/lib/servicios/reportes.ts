import { estaCerrada, rentabilidadPorCliente, type EstadoOrden } from "@/lib/costeo";
import { exigir, type UsuarioActual } from "@/lib/auth/permisos";
import { filtroVisibilidad, type SnapshotCierre } from "./ordenes";
import { aFechaDB, aISO, type Tx } from "./util";

/**
 * Rentabilidad por cliente y por proyecto (Módulo 5 del artículo) sobre órdenes cerradas,
 * con el costo acumulado del cierre y el costo ajustado si el período ya se concilió.
 */
export async function reporteRentabilidad(tx: Tx, u: UsuarioActual, f: { desde?: string; hasta?: string } = {}) {
  exigir(u, "margenes.ver");
  const ordenes = await tx.ordenProyecto.findMany({
    where: {
      AND: [
        { eliminadoEn: null, estado: { in: ["TERMINADO", "FACTURADO"] } },
        filtroVisibilidad(u),
        f.desde ? { fechaTerminacion: { gte: aFechaDB(f.desde) } } : {},
        f.hasta ? { fechaTerminacion: { lte: aFechaDB(f.hasta) } } : {},
      ],
    },
    include: { cliente: true, ajustesCIF: { where: { conciliacion: { anuladaEn: null } } } },
    orderBy: { codigo: "asc" },
  });
  const proyectos = ordenes
    .filter((o) => estaCerrada(o.estado as EstadoOrden) && o.snapshotCierre)
    .map((o) => {
      const r = (o.snapshotCierre as unknown as SnapshotCierre).resumen;
      return {
        id: o.id,
        codigo: o.codigo,
        clienteId: o.clienteId ?? "sin-cliente",
        cliente: o.cliente?.nombre ?? "Sin cliente",
        fechaTerminacion: aISO(o.fechaTerminacion),
        valorCotizado: o.valorCotizado?.toString() ?? null,
        costoTotal: r.costoTotal,
        costoAjustado: o.ajustesCIF[0]?.costoAjustado.toString() ?? null,
        margenPct: r.margenPct,
      };
    });
  return { ...rentabilidadPorCliente(proyectos), proyectos };
}
