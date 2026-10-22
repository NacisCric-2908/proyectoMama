import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requerirSesion, tiene } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { esEditable, estadosDestino, formatearFecha, formatearPesos, formatearPorcentaje, type EstadoOrden } from "@/lib/costeo";
import { cargarOrden, puedeVerOrden, resumenOrden } from "@/lib/servicios/ordenes";
import { estadoCIF } from "@/lib/servicios/cif";
import { aISO, txt } from "@/lib/servicios/util";
import { InsigniaEstado, ListaAlertas, Tarjeta } from "@/components/ui";
import { PanelEstado } from "@/components/orden/PanelEstado";
import { TabDatos } from "@/components/orden/TabDatos";
import { TabMateriales } from "@/components/orden/TabMateriales";
import { TabManoObra } from "@/components/orden/TabManoObra";
import { TabIngenieria } from "@/components/orden/TabIngenieria";
import { TabCIF } from "@/components/orden/TabCIF";
import { TabCotizacion } from "@/components/orden/TabCotizacion";
import { TabHistorial } from "@/components/orden/TabHistorial";

const PESTANAS = [
  ["datos", "Datos generales"],
  ["materiales", "Materiales"],
  ["mano-obra", "Mano de obra"],
  ["ingenieria", "Ingeniería y puesta en marcha"],
  ["cif", "CIF"],
  ["cotizacion", "Cotización y margen"],
  ["historial", "Historial"],
] as const;

export default async function DetalleOrden({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const u = await requerirSesion();
  const { id } = await params;
  const { tab = "datos" } = await searchParams;
  if (!tiene(u, "costos.ver")) redirect(`/mis-horas?orden=${id}`);

  const orden = await cargarOrden(prisma, id).catch(() => notFound());
  if (!puedeVerOrden(u, orden)) redirect("/sin-permiso");
  const resumen = await resumenOrden(prisma, orden);
  const estado = orden.estado as EstadoOrden;
  const editable = esEditable(estado) && tiene(u, "ordenes.editar");
  const verMargen = tiene(u, "margenes.ver");
  const cif = await estadoCIF(prisma, id);
  const puedeCambiarEstado = ["ordenes.cambiarEstado", "ordenes.cerrar", "ordenes.reabrir"].some((p) => tiene(u, p as never));

  return (
    <div className="flex flex-col gap-4">
      {/* Encabezado (siempre visible) */}
      <Tarjeta className="sticky top-0 z-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{orden.codigo}</h1>
              <InsigniaEstado estado={estado} />
            </div>
            <p className="text-sm text-tenue">
              {orden.cliente?.nombre ?? "Sin cliente"} · Entrega: {formatearFecha(aISO(orden.fechaEstimadaEntrega)) || "—"}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-x-6 text-sm">
            <div>
              <dt className="text-tenue">Costo acumulado</dt>
              <dd className="num text-base font-semibold">{formatearPesos(resumen.costoTotal)}</dd>
            </div>
            {verMargen && (
              <>
                <div>
                  <dt className="text-tenue">Valor cotizado</dt>
                  <dd className="num text-base font-semibold">{orden.valorCotizado ? formatearPesos(txt(orden.valorCotizado)) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-tenue">Margen</dt>
                  <dd className="num text-base font-semibold">{resumen.margenPct ? formatearPorcentaje(resumen.margenPct) : "Sin cotización"}</dd>
                </div>
              </>
            )}
          </dl>
          <Link href={`/ordenes/${id}/informe`} className="text-sm text-primario hover:underline">
            {estado === "TERMINADO" || estado === "FACTURADO" ? "Informe de cierre" : "Resumen de costos"} →
          </Link>
        </div>
        <div className="mt-3">
          <ListaAlertas alertas={verMargen ? resumen.alertas : resumen.alertas.filter((a) => a.codigo === "MERMA_ALTA" || a.codigo === "ORDEN_VENCIDA")} />
        </div>
      </Tarjeta>

      {puedeCambiarEstado && <PanelEstado ordenId={id} estado={estado} destinos={estadosDestino(estado)} />}

      <nav className="flex flex-wrap gap-1 border-b border-borde text-sm">
        {PESTANAS.map(([clave, nombre]) => (
          <Link
            key={clave}
            href={`/ordenes/${id}?tab=${clave}`}
            className={`-mb-px rounded-t-md border px-3 py-1.5 ${tab === clave ? "border-borde border-b-superficie bg-superficie font-medium" : "border-transparent text-tenue hover:text-texto"}`}
          >
            {nombre}
          </Link>
        ))}
      </nav>

      {tab === "datos" && <TabDatos orden={orden} usuario={u} editable={editable} />}
      {tab === "materiales" && <TabMateriales orden={orden} resumen={resumen} editable={editable} />}
      {tab === "mano-obra" && <TabManoObra orden={orden} resumen={resumen} usuario={u} editable={editable} />}
      {tab === "ingenieria" && <TabIngenieria orden={orden} resumen={resumen} usuario={u} editable={editable} />}
      {tab === "cif" && (
        <TabCIF ordenId={id} resumen={resumen} cif={cif} asignacion={orden.asignacionCIF} puedeAsignar={esEditable(estado) && tiene(u, "cif.asignar")} />
      )}
      {tab === "cotizacion" && verMargen && <TabCotizacion orden={orden} resumen={resumen} />}
      {tab === "historial" && <TabHistorial orden={orden} verAuditoria={tiene(u, "auditoria.ver")} />}
    </div>
  );
}
