import Link from "next/link";
import { requerirPagina } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import { formatearFecha, formatearPesos, formatearPorcentaje, type FilaRentabilidad } from "@/lib/costeo";
import { reporteRentabilidad } from "@/lib/servicios/reportes";
import { Boton, Campo, EnlaceBoton, Entrada, Tarjeta, Titulo, Vacio } from "@/components/ui";

function Fila({ f, negrita }: { f: FilaRentabilidad; negrita?: boolean }) {
  const rojo = (x: { isNegative(): boolean }) => (x.isNegative() ? "text-peligro" : "");
  return (
    <tr className={negrita ? "font-semibold" : ""}>
      <td>{f.cliente}</td>
      <td className="num">{f.ordenes}</td>
      <td className="num">{formatearPesos(f.cotizado)}</td>
      <td className="num">{formatearPesos(f.costo)}</td>
      <td className={`num ${rojo(f.margen)}`}>{formatearPesos(f.margen)}</td>
      <td className={`num ${rojo(f.margen)}`}>{f.margenPct ? formatearPorcentaje(f.margenPct) : "Sin cotización"}</td>
      <td className="num">
        {formatearPesos(f.costoAjustado)}
        {f.ordenesAjustadas < f.ordenes && <div className="text-xs text-tenue">{f.ordenesAjustadas} de {f.ordenes} conciliadas</div>}
      </td>
      <td className={`num ${rojo(f.margenAjustado)}`}>{f.margenAjustadoPct ? formatearPorcentaje(f.margenAjustadoPct) : "—"}</td>
    </tr>
  );
}

export default async function Rentabilidad({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const u = await requerirPagina("margenes.ver");
  const f = await searchParams;
  const r = await reporteRentabilidad(prisma, u, f);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="flex flex-col gap-4">
      <Titulo acciones={<EnlaceBoton variante="secundario" href={`/api/reportes/rentabilidad?${qs}`} prefetch={false}>Descargar CSV (Excel)</EnlaceBoton>}>
        Rentabilidad por cliente y por proyecto
      </Titulo>
      <Tarjeta>
        <form className="flex flex-wrap items-end gap-3">
          <Campo etiqueta="Terminadas desde">
            <Entrada type="date" name="desde" defaultValue={f.desde} />
          </Campo>
          <Campo etiqueta="Terminadas hasta">
            <Entrada type="date" name="hasta" defaultValue={f.hasta} />
          </Campo>
          <Boton>Filtrar</Boton>
          <Link href="/reportes/rentabilidad" className="text-sm text-primario hover:underline">
            Limpiar
          </Link>
        </form>
        <p className="mt-2 text-xs text-tenue">
          Órdenes cerradas (Terminado o Facturado). Costo acumulado = valores congelados al cierre, con CIF aplicado. Costo ajustado = tras conciliar el CIF real del período (si
          el período no está conciliado se usa el acumulado). Valores cotizados antes de IVA.
        </p>
      </Tarjeta>
      <Tarjeta titulo="Por cliente">
        {r.filas.length === 0 ? (
          <Vacio>No hay órdenes cerradas en el rango.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="num">Órdenes</th>
                  <th className="num">Cotizado</th>
                  <th className="num">Costo acumulado</th>
                  <th className="num">Margen</th>
                  <th className="num">Margen %</th>
                  <th className="num">Costo ajustado</th>
                  <th className="num">Margen ajustado %</th>
                </tr>
              </thead>
              <tbody>
                {r.filas.map((x) => (
                  <Fila key={x.clienteId} f={x} />
                ))}
              </tbody>
              <tfoot>
                <Fila f={r.total} negrita />
              </tfoot>
            </table>
          </div>
        )}
      </Tarjeta>
      {r.proyectos.length > 0 && (
        <Tarjeta titulo="Por proyecto">
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Terminada</th>
                  <th className="num">Cotizado</th>
                  <th className="num">Costo acumulado</th>
                  <th className="num">Margen %</th>
                  <th className="num">Costo ajustado</th>
                </tr>
              </thead>
              <tbody>
                {r.proyectos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/ordenes/${p.id}/informe`} className="text-primario hover:underline">
                        {p.codigo}
                      </Link>
                    </td>
                    <td>{p.cliente}</td>
                    <td>{formatearFecha(p.fechaTerminacion)}</td>
                    <td className="num">{p.valorCotizado ? formatearPesos(p.valorCotizado) : "—"}</td>
                    <td className="num">{formatearPesos(p.costoTotal)}</td>
                    <td className="num">{p.margenPct ? formatearPorcentaje(p.margenPct) : "Sin cotización"}</td>
                    <td className="num">{p.costoAjustado ? formatearPesos(p.costoAjustado) : <span className="text-tenue">Sin conciliar</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
