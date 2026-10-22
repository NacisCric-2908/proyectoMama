import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requerirSesion, tiene } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { BASES_CIF, formatearCantidad, formatearFecha, formatearPesos, NOMBRE_GRUPO, type EstadoOrden } from "@/lib/costeo";
import { cargarOrden, puedeVerOrden, resumenOrden, type ResumenSerializado, type SnapshotCierre } from "@/lib/servicios/ordenes";
import { aISO } from "@/lib/servicios/util";
import { EnlaceBoton, InsigniaEstado, ListaAlertas, Tarjeta } from "@/components/ui";
import { EstimadoVsReal, TablaCostos } from "@/components/orden/TablaCostos";
import { GraficoParticipacion } from "@/components/orden/GraficoParticipacion";

export default async function Informe({ params }: { params: Promise<{ id: string }> }) {
  const u = await requerirSesion();
  const { id } = await params;
  if (!tiene(u, "costos.ver")) redirect("/mis-horas");
  const orden = await cargarOrden(prisma, id).catch(() => notFound());
  if (!puedeVerOrden(u, orden)) redirect("/sin-permiso");
  const r = await resumenOrden(prisma, orden);
  const verMargen = tiene(u, "margenes.ver");
  const snap = orden.snapshotCierre as unknown as SnapshotCierre | null;
  const estimado = orden.estimadoAlCotizar as unknown as ResumenSerializado | null;
  const p = await prisma.parametrosGenerales.findUnique({ where: { id: 1 } });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/ordenes/${id}`} className="text-sm text-primario hover:underline">← Volver a la orden</Link>
          <h1 className="text-xl font-semibold">
            {snap ? "Informe de cierre" : "Resumen de costos"} · {orden.codigo} <InsigniaEstado estado={orden.estado as EstadoOrden} />
          </h1>
          <p className="text-sm text-tenue">
            {p?.nombreEmpresa} · {orden.cliente?.nombre} · {orden.descripcion}
          </p>
        </div>
        <EnlaceBoton href={`/api/ordenes/${id}/pdf`} prefetch={false}>Descargar PDF</EnlaceBoton>
      </div>
      {!snap && <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-900">La orden está abierta: los valores se recalculan en tiempo real y se congelan al cerrarla.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Resumen">
          <TablaCostos r={r} verMargen={verMargen} />
          <p className="mt-3 text-sm">
            Cantidad de unidades: <strong>{formatearCantidad(r.cantidadUnidades)}</strong> · Costo unitario: <strong>{formatearPesos(r.costoUnitario)}</strong>
          </p>
        </Tarjeta>
        <Tarjeta>
          <GraficoParticipacion r={r} />
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-medium">Alertas</h3>
            {r.alertas.length ? <ListaAlertas alertas={r.alertas} /> : <p className="text-sm text-tenue">Sin alertas.</p>}
          </div>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Ingeniería, automatización, pruebas y puesta en marcha por etapa">
        <table className="tabla">
          <thead><tr><th>Etapa</th><th>Grupo</th><th className="num">Horas</th><th className="num">Costo</th></tr></thead>
          <tbody>
            {r.ingenieria.porEtapa.filter((e) => Number(e.horas) > 0 || Number(e.costo) > 0).map((e) => (
              <tr key={e.etapaId}><td>{e.nombre}</td><td>{NOMBRE_GRUPO[e.grupo]}</td><td className="num">{formatearCantidad(e.horas)}</td><td className="num">{formatearPesos(e.costo)}</td></tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={2}>Total</td><td className="num">{formatearCantidad(r.ingenieria.horasIngenieria)}</td><td className="num">{formatearPesos(r.ingenieria.costoIngenieria)}</td></tr></tfoot>
        </table>
      </Tarjeta>

      <Tarjeta titulo="Detalle de materiales">
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead><tr><th>Código</th><th>Descripción</th><th>Und</th><th className="num">Requerida</th><th className="num">Entregada</th><th className="num">Utilizada</th><th className="num">Devuelta</th><th className="num">Merma</th><th className="num">Costo unit.</th><th className="num">Costo</th><th className="num">Costo merma</th></tr></thead>
            <tbody>
              {r.materiales.lineas.map((l, i) => (
                <tr key={l.id ?? i}><td>{l.codigo}</td><td>{l.descripcion}</td><td>{l.unidad}</td><td className="num">{formatearCantidad(l.requerida)}</td><td className="num">{formatearCantidad(l.entregada)}</td><td className="num">{formatearCantidad(l.utilizada)}</td><td className="num">{formatearCantidad(l.devuelta)}</td><td className="num">{formatearCantidad(l.merma)}</td><td className="num">{formatearPesos(l.costoUnitario)}</td><td className="num">{formatearPesos(l.costoLinea)}</td><td className="num">{formatearPesos(l.costoMerma)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={9}>Totales</td><td className="num">{formatearPesos(r.materiales.costoMaterialesDirectos)}</td><td className="num">{formatearPesos(r.materiales.costoMermas)}</td></tr></tfoot>
          </table>
        </div>
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta titulo="Detalle de mano de obra directa">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Trabajador</th><th>Actividad</th><th className="num">Horas</th><th className="num">Tarifa</th><th className="num">Costo</th></tr></thead>
            <tbody>
              {r.mod.registros.map((m, i) => (
                <tr key={m.id ?? i}><td>{formatearFecha(m.fecha)}</td><td>{m.trabajador}</td><td>{m.actividad}</td><td className="num">{formatearCantidad(m.horas)}</td><td className="num">{formatearPesos(m.tarifa)}</td><td className="num">{formatearPesos(m.costo)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3}>Total</td><td className="num">{formatearCantidad(r.mod.horasMOD)}</td><td /><td className="num">{formatearPesos(r.mod.costoMOD)}</td></tr></tfoot>
          </table>
        </Tarjeta>
        <Tarjeta titulo="Cálculo del CIF">
          {r.cif ? (
            <p className="text-sm">
              Base: <strong>{r.cif.nombreBase}</strong> · Cantidad: <strong>{BASES_CIF[r.cif.base].esPorcentaje ? formatearPesos(r.cif.cantidadBase) : formatearCantidad(r.cif.cantidadBase)}</strong> · Tasa:{" "}
              <strong>{BASES_CIF[r.cif.base].esPorcentaje ? `${formatearCantidad(r.cif.tasa)} %` : formatearPesos(r.cif.tasa)}</strong> ({r.cif.unidadTasa}) · CIF: <strong>{formatearPesos(r.cif.valor)}</strong>
            </p>
          ) : (
            <p className="text-sm text-advertencia">Sin CIF asignado.</p>
          )}
        </Tarjeta>
      </div>

      {estimado && (
        <Tarjeta titulo="Estimado al cotizar vs real">
          <EstimadoVsReal estimado={estimado} real={r} />
        </Tarjeta>
      )}

      {snap && (
        <p className="text-sm text-tenue">
          Cerrada el {formatearFecha(snap.cerradoEn)} por {snap.cerradoPor}. Fecha de terminación: {formatearFecha(aISO(orden.fechaTerminacion))}.
        </p>
      )}
    </div>
  );
}
