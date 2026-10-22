import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirPagina, tiene } from "@/lib/auth/sesion";
import { prisma } from "@/lib/db";
import {
  formatearFecha,
  formatearPesos,
  formatearPorcentaje,
  NOMBRE_ESTADO,
  NOMBRE_POLITICA,
  NOMBRE_TIPO_DIFERENCIA,
  type EstadoOrden,
  type PoliticaAjusteCIF,
} from "@/lib/costeo";
import { conciliacionVigente, previsualizarConciliacion } from "@/lib/servicios/conciliacion";
import { FormularioAccion } from "@/components/FormularioAccion";
import { Boton, Campo, Entrada, Selector, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { accionAgregarConceptoCIF, accionAnularConciliacion, accionConciliar, accionEliminarConceptoCIF } from "../acciones";

const POLITICAS = Object.keys(NOMBRE_POLITICA) as PoliticaAjusteCIF[];

export default async function PeriodoCIF({ params, searchParams }: { params: Promise<{ periodo: string }>; searchParams: Promise<{ politica?: string }> }) {
  const u = await requerirPagina("cif.conciliar", "cif.configurar");
  const { periodo } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) notFound();
  const { politica: p } = await searchParams;
  const politica: PoliticaAjusteCIF = POLITICAS.includes(p as PoliticaAjusteCIF) ? (p as PoliticaAjusteCIF) : "PRORRATEO_CIF_APLICADO";
  const puedeConciliar = tiene(u, "cif.conciliar");

  const [vista, vigente, anuladas] = await Promise.all([
    previsualizarConciliacion(prisma, periodo, politica),
    conciliacionVigente(prisma, periodo),
    prisma.conciliacionCIF.findMany({ where: { periodo, anuladaEn: { not: null } }, orderBy: { fecha: "desc" } }),
  ]);
  const codigos = Object.fromEntries(
    (await prisma.ordenProyecto.findMany({ where: { id: { in: vigente?.ajustes.map((a) => a.ordenId) ?? [] } }, select: { id: true, codigo: true } })).map((o) => [o.id, o.codigo]),
  );
  const r = vista.resultado;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/cif" className="text-sm text-primario hover:underline">
        ← Períodos de CIF
      </Link>
      <Titulo>CIF real y conciliación · {periodo}</Titulo>
      <p className="text-sm text-tenue">
        El CIF aplicado a cada orden (tasa predeterminada × base real) se concilia con el CIF real del período. Diferencia = CIF real − Σ CIF aplicado: positiva es
        subaplicación y negativa sobreaplicación. El costo ajustado de cada orden = costo acumulado + su parte de la diferencia, según la política adoptada.
      </p>

      <Tarjeta titulo="CIF real del período por concepto">
        {vista.conceptos.length === 0 ? (
          <Vacio>No se ha registrado el CIF real del período.</Vacio>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Soporte</th>
                <th>Observaciones</th>
                <th className="num">Valor</th>
                {puedeConciliar && !vigente && <th />}
              </tr>
            </thead>
            <tbody>
              {vista.conceptos.map((c) => (
                <tr key={c.id}>
                  <td>{c.concepto}</td>
                  <td>{c.soporte}</td>
                  <td>{c.observaciones}</td>
                  <td className="num">{formatearPesos(c.valor.toString())}</td>
                  {puedeConciliar && !vigente && (
                    <td>
                      <FormularioAccion accion={accionEliminarConceptoCIF} confirmar="¿Eliminar este concepto?">
                        <input type="hidden" name="id" value={c.id} />
                        <button className="text-xs text-peligro hover:underline">Eliminar</button>
                      </FormularioAccion>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>CIF real total</td>
                <td className="num">{formatearPesos(vista.cifReal)}</td>
                {puedeConciliar && !vigente && <td />}
              </tr>
            </tfoot>
          </table>
        )}
        {puedeConciliar && !vigente && (
          <FormularioAccion accion={accionAgregarConceptoCIF} reiniciar className="mt-3 grid items-end gap-3 sm:grid-cols-5">
            <input type="hidden" name="periodo" value={periodo} />
            <Campo etiqueta="Concepto" className="sm:col-span-2">
              <Entrada name="concepto" required placeholder="Arriendo de planta, energía, depreciación…" />
            </Campo>
            <Campo etiqueta="Valor">
              <Entrada name="valor" inputMode="decimal" required />
            </Campo>
            <Campo etiqueta="Soporte">
              <Entrada name="soporte" placeholder="Factura, comprobante…" />
            </Campo>
            <Boton>Agregar</Boton>
            <Campo etiqueta="Observaciones" className="sm:col-span-5">
              <Entrada name="observaciones" />
            </Campo>
          </FormularioAccion>
        )}
        <p className="mt-2 text-xs text-tenue">Incluya solo costos de producción: los gastos de administración y ventas y los costos ya cargados directamente a las órdenes no forman parte del CIF.</p>
      </Tarjeta>

      {vigente ? (
        <Tarjeta titulo="Conciliación vigente">
          <dl className="mb-3 grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-tenue">CIF real</dt>
              <dd className="font-medium">{formatearPesos(vigente.cifReal.toString())}</dd>
            </div>
            <div>
              <dt className="text-tenue">CIF aplicado</dt>
              <dd className="font-medium">{formatearPesos(vigente.cifAplicado.toString())}</dd>
            </div>
            <div>
              <dt className="text-tenue">Diferencia</dt>
              <dd className="font-semibold">{formatearPesos(vigente.diferencia.toString())}</dd>
            </div>
            <div>
              <dt className="text-tenue">Al costo de ventas</dt>
              <dd className="font-medium">{formatearPesos(vigente.ajusteCostoVentas.toString())}</dd>
            </div>
          </dl>
          <p className="mb-3 text-sm">
            {NOMBRE_POLITICA[vigente.politica]}. Conciliado el {formatearFecha(vigente.fecha)} por {vigente.usuarioNombre}.
            {vigente.observaciones && <> Observaciones: {vigente.observaciones}</>}
          </p>
          <table className="tabla">
            <thead>
              <tr>
                <th>Orden</th>
                <th className="num">CIF aplicado</th>
                <th className="num">Ajuste</th>
                <th className="num">Costo acumulado</th>
                <th className="num">Costo ajustado</th>
              </tr>
            </thead>
            <tbody>
              {vigente.ajustes.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/ordenes/${a.ordenId}?tab=cotizacion`} className="text-primario hover:underline">
                      {codigos[a.ordenId]}
                    </Link>
                  </td>
                  <td className="num">{formatearPesos(a.cifAplicado.toString())}</td>
                  <td className="num">{formatearPesos(a.ajuste.toString())}</td>
                  <td className="num">{formatearPesos(a.costoAcumulado.toString())}</td>
                  <td className="num font-semibold">{formatearPesos(a.costoAjustado.toString())}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {puedeConciliar && (
            <FormularioAccion accion={accionAnularConciliacion} confirmar="¿Anular la conciliación? Las órdenes vuelven a mostrar solo el costo acumulado." className="mt-4 grid items-end gap-3 sm:grid-cols-4">
              <input type="hidden" name="id" value={vigente.id} />
              <Campo etiqueta="Motivo de la anulación" className="sm:col-span-3">
                <Entrada name="motivo" required />
              </Campo>
              <Boton variante="peligro">Anular conciliación</Boton>
            </FormularioAccion>
          )}
        </Tarjeta>
      ) : (
        <Tarjeta titulo="Vista previa de la conciliación">
          <form className="mb-3 flex flex-wrap items-end gap-2">
            <Campo etiqueta="Política para la diferencia">
              <Selector name="politica" defaultValue={politica}>
                {POLITICAS.map((x) => (
                  <option key={x} value={x}>
                    {NOMBRE_POLITICA[x]}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Boton variante="secundario">Ver</Boton>
          </form>
          {vista.pendientes.length > 0 && (
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              ⚠️ Para conciliar, todas las órdenes del período deben estar cerradas o anuladas. Pendientes:{" "}
              {vista.pendientes.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && ", "}
                  <Link href={`/ordenes/${o.id}`} className="underline">
                    {o.codigo}
                  </Link>{" "}
                  ({NOMBRE_ESTADO[o.estado as EstadoOrden]})
                </span>
              ))}
              . La vista previa solo incluye las órdenes cerradas.
            </div>
          )}
          {vista.error && <p className="mb-3 text-sm text-peligro">{vista.error}</p>}
          {r && (
            <>
              <dl className="mb-3 grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-tenue">CIF real</dt>
                  <dd className="font-medium">{formatearPesos(r.cifReal)}</dd>
                </div>
                <div>
                  <dt className="text-tenue">CIF aplicado (órdenes cerradas)</dt>
                  <dd className="font-medium">{formatearPesos(r.cifAplicado)}</dd>
                </div>
                <div>
                  <dt className="text-tenue">Diferencia</dt>
                  <dd className="font-semibold">{formatearPesos(r.diferencia)}</dd>
                </div>
                <div>
                  <dt className="text-tenue">Resultado</dt>
                  <dd className="font-medium">{NOMBRE_TIPO_DIFERENCIA[r.tipo]}</dd>
                </div>
              </dl>
              {r.ajustes.length === 0 ? (
                <Vacio>No hay órdenes cerradas con CIF asignado en este período.</Vacio>
              ) : (
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Orden</th>
                      <th className="num">CIF aplicado</th>
                      <th className="num">Ajuste</th>
                      <th className="num">Costo acumulado</th>
                      <th className="num">Costo ajustado</th>
                      <th className="num">Margen ajustado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.ajustes.map((a) => (
                      <tr key={a.id}>
                        <td>{a.codigo}</td>
                        <td className="num">{formatearPesos(a.cifAplicado)}</td>
                        <td className="num">{formatearPesos(a.ajuste)}</td>
                        <td className="num">{formatearPesos(a.costoAcumulado)}</td>
                        <td className="num font-semibold">{formatearPesos(a.costoAjustado)}</td>
                        <td className="num">{a.margenAjustadoPct ? formatearPorcentaje(a.margenAjustadoPct) : "Sin cotización"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
          {puedeConciliar && (
            <FormularioAccion
              accion={accionConciliar.bind(null, periodo)}
              confirmar="¿Conciliar el período? Se registrará el costo ajustado de cada orden y no podrá modificar el CIF real hasta anular la conciliación."
              className="mt-4 grid items-end gap-3 sm:grid-cols-4"
            >
              <input type="hidden" name="politica" value={politica} />
              <Campo etiqueta="Observaciones (tratamiento de la diferencia)" className="sm:col-span-3">
                <Entrada name="observaciones" />
              </Campo>
              <Boton disabled={vista.pendientes.length > 0 || vista.conceptos.length === 0 || !r}>Conciliar período</Boton>
            </FormularioAccion>
          )}
        </Tarjeta>
      )}

      {anuladas.length > 0 && (
        <Tarjeta titulo="Conciliaciones anuladas">
          <ul className="text-sm">
            {anuladas.map((a) => (
              <li key={a.id} className="border-b border-borde py-1.5">
                {formatearFecha(a.fecha)} · diferencia {formatearPesos(a.diferencia.toString())} · anulada el {formatearFecha(a.anuladaEn)} por {a.anuladaPor}: {a.motivoAnulacion}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}
