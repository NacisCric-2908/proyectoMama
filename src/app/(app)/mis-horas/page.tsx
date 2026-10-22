import Link from "next/link";
import { requerirPagina } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { formatearCantidad, formatearFecha, type EstadoOrden } from "@/lib/costeo";
import { trabajadoresConTarifas } from "@/lib/servicios/trabajadores";
import { aISO } from "@/lib/servicios/util";
import { InsigniaEstado, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { FormularioMOD } from "@/components/orden/FormularioMOD";
import { FormularioIngenieria } from "@/components/orden/FormularioIngenieria";
import { EliminarLinea } from "@/components/orden/EliminarLinea";
import { accionGuardarIngenieria, accionGuardarMOD } from "../ordenes/acciones";

const ABIERTOS: EstadoOrden[] = ["BORRADOR", "COTIZADO", "EN_INGENIERIA", "EN_FABRICACION", "EN_PRUEBAS", "EN_PUESTA_MARCHA"];

export default async function MisHoras({ searchParams }: { searchParams: Promise<{ orden?: string }> }) {
  const u = await requerirPagina("horas.registrarPropias");
  if (!u.trabajadorId) return <Vacio>Su usuario no está asociado a un trabajador. Pida al administrador que lo asocie.</Vacio>;
  const { orden: ordenId } = await searchParams;

  const ordenes = await prisma.ordenProyecto.findMany({
    where: { eliminadoEn: null, estado: { in: ABIERTOS }, tecnicos: { some: { trabajadorId: u.trabajadorId } } },
    select: { id: true, codigo: true, descripcion: true, estado: true, cliente: { select: { nombre: true } } },
    orderBy: { codigo: "desc" },
  });
  const actual = ordenes.find((o) => o.id === ordenId) ?? (ordenes.length === 1 ? ordenes[0] : null);
  // Sin tarifas: el técnico no ve costos; el servidor aplica la tarifa vigente.
  const [yo] = (await trabajadoresConTarifas(prisma, u.trabajadorId)).map((t) => ({ ...t, tarifas: [] }));
  const etapas = await prisma.etapa.findMany({ where: { activa: true }, orderBy: { orden: "asc" } });

  const [mod, ing] = actual
    ? await Promise.all([
        prisma.registroMOD.findMany({ where: { ordenId: actual.id, trabajadorId: u.trabajadorId, eliminadoEn: null }, orderBy: { fecha: "desc" } }),
        prisma.registroIngenieria.findMany({
          where: { ordenId: actual.id, responsableId: u.trabajadorId, eliminadoEn: null },
          include: { etapa: true },
          orderBy: { fechaInicio: "desc" },
        }),
      ])
    : [[], []];

  return (
    <div className="flex flex-col gap-4">
      <Titulo>Mis horas</Titulo>
      <Tarjeta titulo="Órdenes asignadas">
        {ordenes.length === 0 ? (
          <Vacio>No tiene órdenes abiertas asignadas.</Vacio>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {ordenes.map((o) => (
              <li key={o.id}>
                <Link href={`/mis-horas?orden=${o.id}`} className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 ${actual?.id === o.id ? "bg-fondo font-medium" : "hover:bg-fondo"}`}>
                  {o.codigo} <InsigniaEstado estado={o.estado as EstadoOrden} />
                  <span className="text-tenue">{o.cliente?.nombre} · {o.descripcion}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {actual && yo && (
        <>
          {yo.tipo !== "INGENIERIA" && (
            <Tarjeta titulo={`Registrar horas de fabricación · ${actual.codigo}`}>
              <FormularioMOD accion={accionGuardarMOD.bind(null, actual.id)} trabajadores={[yo]} puedeEditarTarifa={false} ocultarTarifa textoBoton="Registrar" />
            </Tarjeta>
          )}
          {yo.tipo !== "FABRICACION" && (
            <Tarjeta titulo={`Registrar horas de ingeniería, pruebas o puesta en marcha · ${actual.codigo}`}>
              <FormularioIngenieria accion={accionGuardarIngenieria.bind(null, actual.id)} etapas={etapas} trabajadores={[yo]} puedeEditarTarifa={false} ocultarTarifa textoBoton="Registrar" />
            </Tarjeta>
          )}
          <Tarjeta titulo="Mis registros en esta orden">
            {mod.length + ing.length === 0 ? (
              <Vacio>Aún no tiene horas registradas en esta orden.</Vacio>
            ) : (
              <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo / etapa</th>
                    <th>Actividad</th>
                    <th className="num">Horas</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {mod.map((r) => (
                    <tr key={r.id}>
                      <td>{formatearFecha(aISO(r.fecha))}</td>
                      <td>Fabricación</td>
                      <td>{r.actividad}</td>
                      <td className="num">{formatearCantidad(r.horas.toString())}</td>
                      <td>
                        <EliminarLinea ordenId={actual.id} tipo="mod" lineaId={r.id} />
                      </td>
                    </tr>
                  ))}
                  {ing.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {formatearFecha(aISO(r.fechaInicio))}
                        {r.fechaFin.getTime() !== r.fechaInicio.getTime() && ` – ${formatearFecha(aISO(r.fechaFin))}`}
                      </td>
                      <td>{r.etapa.nombre}</td>
                      <td>{r.descripcion}</td>
                      <td className="num">{formatearCantidad(r.horas.toString())}</td>
                      <td>
                        <EliminarLinea ordenId={actual.id} tipo="ingenieria" lineaId={r.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </Tarjeta>
        </>
      )}
    </div>
  );
}
