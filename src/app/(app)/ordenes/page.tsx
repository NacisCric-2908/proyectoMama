import Link from "next/link";
import { requerirPagina, tiene } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { formatearFecha, formatearPesos, formatearPorcentaje, NOMBRE_ESTADO, type EstadoOrden } from "@/lib/costeo";
import { listarOrdenes } from "@/lib/servicios/ordenes";
import { Boton, Campo, EnlaceBoton, Entrada, IconoAlertas, InsigniaEstado, Selector, Tarjeta, Titulo, Vacio } from "@/components/ui";

type Filtros = { q?: string; clienteId?: string; estado?: string; responsableId?: string; desde?: string; hasta?: string; alertas?: string };

export default async function Ordenes({ searchParams }: { searchParams: Promise<Filtros> }) {
  const u = await requerirPagina("ordenes.verTodas", "ordenes.verPropias");
  const f = await searchParams;
  const [ordenes, clientes, responsables] = await Promise.all([
    listarOrdenes(prisma, u, { ...f, conAlertas: f.alertas === "1" }),
    prisma.cliente.findMany({ where: { eliminadoEn: null }, orderBy: { nombre: "asc" } }),
    prisma.usuario.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);
  const verMargen = tiene(u, "margenes.ver");
  const verCostos = tiene(u, "costos.ver");

  return (
    <div>
      <Titulo acciones={tiene(u, "ordenes.editar") && <EnlaceBoton href="/ordenes/nueva">Nueva orden</EnlaceBoton>}>Órdenes de proyecto</Titulo>
      <Tarjeta className="mb-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <Campo etiqueta="Buscar" className="lg:col-span-2">
            <Entrada name="q" defaultValue={f.q} placeholder="Código, cliente o descripción" />
          </Campo>
          <Campo etiqueta="Cliente">
            <Selector name="clienteId" defaultValue={f.clienteId}>
              <option value="">Todos</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Estado">
            <Selector name="estado" defaultValue={f.estado}>
              <option value="">Todos</option>
              {Object.entries(NOMBRE_ESTADO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Responsable">
            <Selector name="responsableId" defaultValue={f.responsableId}>
              <option value="">Todos</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Creada desde">
            <Entrada type="date" name="desde" defaultValue={f.desde} />
          </Campo>
          <Campo etiqueta="Creada hasta">
            <Entrada type="date" name="hasta" defaultValue={f.hasta} />
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="alertas" value="1" defaultChecked={f.alertas === "1"} /> Solo con alertas
          </label>
          <div className="flex items-end gap-2">
            <Boton>Filtrar</Boton>
            <Link href="/ordenes" className="text-sm text-primario hover:underline">
              Limpiar
            </Link>
          </div>
        </form>
      </Tarjeta>
      <Tarjeta>
        {ordenes.length === 0 ? (
          <Vacio>No hay órdenes con esos filtros.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Cliente</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th>Entrega</th>
                  <th>Responsable</th>
                  {verCostos && <th className="num">Costo acumulado</th>}
                  {verMargen && <th className="num">Cotizado</th>}
                  {verMargen && <th className="num">Margen</th>}
                  <th>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/ordenes/${o.id}`} className="font-medium text-primario hover:underline">
                        {o.codigo}
                      </Link>
                    </td>
                    <td>{o.cliente ?? "—"}</td>
                    <td className="max-w-xs truncate">{o.descripcion}</td>
                    <td>
                      <InsigniaEstado estado={o.estado as EstadoOrden} />
                    </td>
                    <td>{formatearFecha(o.fechaEstimadaEntrega)}</td>
                    <td>{o.responsable ?? "—"}</td>
                    {verCostos && <td className="num">{o.costoTotal ? formatearPesos(o.costoTotal) : "—"}</td>}
                    {verMargen && <td className="num">{o.valorCotizado ? formatearPesos(o.valorCotizado) : "—"}</td>}
                    {verMargen && <td className="num">{o.margenPct ? formatearPorcentaje(o.margenPct) : "Sin cotización"}</td>}
                    <td>
                      <IconoAlertas alertas={o.alertas} />
                      {o.error && <span title={o.error}>❗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
