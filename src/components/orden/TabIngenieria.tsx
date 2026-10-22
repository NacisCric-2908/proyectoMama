import { prisma } from "@/lib/db";
import { tiene, type UsuarioActual } from "@/lib/auth/permisos";
import { d, formatearCantidad, formatearFecha, formatearPesos, NOMBRE_GRUPO, type GrupoEtapa } from "@/lib/costeo";
import type { OrdenCompleta, ResumenSerializado } from "@/lib/servicios/ordenes";
import { trabajadoresConTarifas } from "@/lib/servicios/trabajadores";
import { aISO } from "@/lib/servicios/util";
import { FormularioAccion } from "@/components/FormularioAccion";
import { Boton, Campo, Entrada, Selector, Tarjeta, Vacio } from "@/components/ui";
import { FormularioIngenieria } from "./FormularioIngenieria";
import { EliminarLinea } from "./EliminarLinea";
import { accionGuardarIngenieria, accionGuardarServicio } from "@/app/(app)/ordenes/acciones";

export async function TabIngenieria({ orden, resumen, usuario, editable }: { orden: OrdenCompleta; resumen: ResumenSerializado; usuario: UsuarioActual; editable: boolean }) {
  const [etapasDB, todos] = await Promise.all([prisma.etapa.findMany({ orderBy: { orden: "asc" } }), trabajadoresConTarifas(prisma)]);
  const etapas = etapasDB.filter((e) => e.activa);
  const trabajadores = todos.filter((t) => t.tipo !== "FABRICACION");
  const puedeEditarTarifa = tiene(usuario, "tarifas.editarEnRegistro");
  const accion = accionGuardarIngenieria.bind(null, orden.id);
  const ing = resumen.ingenieria;
  const grupos: GrupoEtapa[] = ["INGENIERIA_AUTOMATIZACION", "PRUEBAS_PUESTA_MARCHA"];

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Resumen por etapa">
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Etapa</th>
                <th className="num">Horas</th>
                <th className="num">Costo horas</th>
                <th className="num">Servicios adicionales</th>
                <th className="num">Costo etapa</th>
              </tr>
            </thead>
            {grupos.map((g) => (
              <tbody key={g}>
                {ing.porEtapa
                  .filter((e) => e.grupo === g)
                  .map((e) => (
                    <tr key={e.etapaId}>
                      <td>{e.nombre}</td>
                      <td className="num">{formatearCantidad(e.horas)}</td>
                      <td className="num">{formatearPesos(e.costoHoras)}</td>
                      <td className="num">{formatearPesos(e.costoServicios)}</td>
                      <td className="num">{formatearPesos(e.costo)}</td>
                    </tr>
                  ))}
                <tr className="bg-fondo font-semibold">
                  <td>{NOMBRE_GRUPO[g]}</td>
                  <td className="num">{formatearCantidad(ing.porGrupo[g].horas)}</td>
                  <td />
                  <td />
                  <td className="num">{formatearPesos(ing.porGrupo[g].costo)}</td>
                </tr>
              </tbody>
            ))}
            <tfoot>
              <tr>
                <td>Total ingeniería y puesta en marcha</td>
                <td className="num">{formatearCantidad(ing.horasIngenieria)}</td>
                <td />
                <td />
                <td className="num">{formatearPesos(ing.costoIngenieria)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-sm">
          Costo acumulado del proyecto (costo directo + ingeniería y puesta en marcha):{" "}
          <strong>{formatearPesos(d(resumen.costoDirecto).plus(d(ing.costoIngenieria)))}</strong>
        </p>
      </Tarjeta>

      <Tarjeta titulo="Registros de horas" className="relative">
        {orden.registrosIng.length === 0 ? (
          <Vacio>Sin registros de ingeniería.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th>Responsable</th>
                  <th>Fechas</th>
                  <th>Actividad</th>
                  <th className="num">Horas</th>
                  <th className="num">Costo hora</th>
                  <th className="num">Costo</th>
                  {editable && <th />}
                </tr>
              </thead>
              <tbody>
                {orden.registrosIng.map((r) => (
                  <tr key={r.id}>
                    <td>{r.etapa.nombre}</td>
                    <td>{r.responsable.nombre}</td>
                    <td className="whitespace-nowrap">
                      {formatearFecha(aISO(r.fechaInicio))} – {formatearFecha(aISO(r.fechaFin))}
                    </td>
                    <td>
                      {r.descripcion}
                      {r.observacionesTecnicas && <div className="text-xs text-tenue">{r.observacionesTecnicas}</div>}
                    </td>
                    <td className="num">{formatearCantidad(r.horas.toString())}</td>
                    <td className="num">{formatearPesos(r.costoHoraAplicado.toString())}</td>
                    <td className="num">{formatearPesos(r.horas.times(r.costoHoraAplicado).toString())}</td>
                    {editable && (
                      <td className="whitespace-nowrap">
                        <details>
                          <summary className="cursor-pointer text-xs text-primario">Editar</summary>
                          <div className="absolute left-4 right-4 z-20 mt-1 rounded-lg border border-borde bg-superficie p-3 shadow-lg">
                            <FormularioIngenieria
                              accion={accion}
                              etapas={etapasDB}
                              trabajadores={trabajadores}
                              puedeEditarTarifa={puedeEditarTarifa}
                              textoBoton="Guardar"
                              inicial={{
                                id: r.id,
                                etapaId: r.etapaId,
                                responsableId: r.responsableId,
                                fechaInicio: aISO(r.fechaInicio)!,
                                fechaFin: aISO(r.fechaFin)!,
                                horas: r.horas.toString(),
                                costoHora: r.costoHoraAplicado.toString(),
                                descripcion: r.descripcion,
                                observacionesTecnicas: r.observacionesTecnicas,
                              }}
                            />
                          </div>
                        </details>
                        <EliminarLinea ordenId={orden.id} tipo="ingenieria" lineaId={r.id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
      {editable && (
        <Tarjeta titulo="Registrar horas de ingeniería, pruebas o puesta en marcha">
          <FormularioIngenieria accion={accion} etapas={etapas} trabajadores={trabajadores} puedeEditarTarifa={puedeEditarTarifa} textoBoton="Agregar" />
          <p className="mt-2 text-xs text-tenue">Los materiales usados en una etapa se registran en la pestaña Materiales, marcando la etapa asociada.</p>
        </Tarjeta>
      )}

      <Tarjeta titulo="Servicios adicionales por etapa">
        {orden.servicios.length === 0 ? (
          <Vacio>Sin servicios adicionales (alquiler de equipos, transporte, terceros…).</Vacio>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Descripción</th>
                <th className="num">Valor</th>
                {editable && <th />}
              </tr>
            </thead>
            <tbody>
              {orden.servicios.map((s) => (
                <tr key={s.id}>
                  <td>{s.etapa.nombre}</td>
                  <td>{s.descripcion}</td>
                  <td className="num">{formatearPesos(s.valor.toString())}</td>
                  {editable && (
                    <td>
                      <EliminarLinea ordenId={orden.id} tipo="servicio" lineaId={s.id} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {editable && (
          <FormularioAccion accion={accionGuardarServicio.bind(null, orden.id)} reiniciar className="mt-3 grid items-end gap-3 sm:grid-cols-4">
            <Campo etiqueta="Etapa">
              <Selector name="etapaId" required>
                {etapas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Descripción" className="sm:col-span-2">
              <Entrada name="descripcion" required />
            </Campo>
            <Campo etiqueta="Valor">
              <Entrada name="valor" inputMode="decimal" required />
            </Campo>
            <div>
              <Boton>Agregar servicio</Boton>
            </div>
          </FormularioAccion>
        )}
      </Tarjeta>
    </div>
  );
}
