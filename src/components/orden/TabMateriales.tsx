import { prisma } from "@/lib/db";
import { d, formatearCantidad, formatearPesos, formatearPorcentaje, hoyBogota, NOMBRE_CLASIFICACION_MERMA } from "@/lib/costeo";
import type { OrdenCompleta, ResumenSerializado } from "@/lib/servicios/ordenes";
import { CATEGORIAS_MATERIAL } from "@/lib/servicios/catalogos";
import { txt } from "@/lib/servicios/util";
import { Boton, Campo, Entrada, Selector, Tarjeta, Vacio } from "@/components/ui";
import { FormularioAccion } from "@/components/FormularioAccion";
import { FormularioConsumo } from "./FormularioConsumo";
import { NuevoMaterial } from "./NuevoMaterial";
import { EliminarLinea } from "./EliminarLinea";
import { accionDevolucion, accionGuardarConsumo, accionRequisicion } from "@/app/(app)/ordenes/acciones";

export async function TabMateriales({
  orden,
  resumen,
  editable,
  puedeInventario,
}: {
  orden: OrdenCompleta;
  resumen: ResumenSerializado;
  editable: boolean;
  /** Puede registrar requisiciones y devoluciones (orden abierta y permiso de inventario). */
  puedeInventario: boolean;
}) {
  const [catalogo, etapas] = await Promise.all([
    prisma.material.findMany({ where: { eliminadoEn: null, activo: true }, orderBy: { codigo: "asc" } }),
    prisma.etapa.findMany({ orderBy: { orden: "asc" } }),
  ]);
  const materiales = catalogo.map((m) => ({ id: m.id, codigo: m.codigo, descripcion: m.descripcion, unidad: m.unidad, costo: m.costoReferencia.toString() }));
  const nombreEtapa = Object.fromEntries(etapas.map((e) => [e.id, e.nombre]));
  const accion = accionGuardarConsumo.bind(null, orden.id);
  const m = resumen.materiales;

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta className="relative" titulo="Materiales y mermas" acciones={editable && <NuevoMaterial categorias={CATEGORIAS_MATERIAL} />}>
        {m.lineas.length === 0 ? (
          <Vacio>Aún no hay materiales en esta orden.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Und</th>
                  <th className="num">Requerida</th>
                  <th className="num">Entregada</th>
                  <th className="num">Utilizada</th>
                  <th className="num">Devuelta</th>
                  <th className="num">Merma</th>
                  <th className="num">Costo unit.</th>
                  <th className="num">Costo</th>
                  <th className="num">Costo merma</th>
                  <th className="num">Dif. vs lista</th>
                  {editable && <th />}
                </tr>
              </thead>
              <tbody>
                {m.lineas.map((l) => {
                  const db = orden.materiales.find((x) => x.id === l.id);
                  return (
                    <tr key={l.id}>
                      <td>{l.codigo}</td>
                      <td>
                        {l.descripcion}
                        {l.etapaId && <div className="text-xs text-tenue">Etapa: {nombreEtapa[l.etapaId]}</div>}
                        {db?.causaMerma && <div className="text-xs text-tenue">Causa merma: {db.causaMerma}</div>}
                        {db?.disposicionMerma && <div className="text-xs text-tenue">Disposición: {db.disposicionMerma}</div>}
                        {db && db._count.movimientos > 0 && <div className="text-xs text-exito">Entregado por kárdex</div>}
                      </td>
                      <td>{l.unidad}</td>
                      <td className="num">{formatearCantidad(l.requerida)}</td>
                      <td className="num">{l.entregadaRegistrada ? formatearCantidad(l.entregada) : <span className="text-tenue">—</span>}</td>
                      <td className="num">{formatearCantidad(l.utilizada)}</td>
                      <td className="num">{formatearCantidad(l.devuelta)}</td>
                      <td className="num">
                        {formatearCantidad(l.merma)}
                        {Number(l.merma) > 0 && (
                          <div className="text-xs text-tenue">
                            {formatearPorcentaje(l.mermaPct)}
                            {l.clasificacionMerma && <> · {NOMBRE_CLASIFICACION_MERMA[l.clasificacionMerma].split(" ")[0]}</>}
                          </div>
                        )}
                      </td>
                      <td className="num">{formatearPesos(l.costoUnitario)}</td>
                      <td className="num">{formatearPesos(l.costoLinea)}</td>
                      <td className="num">
                        {formatearPesos(l.costoMermaNeto)}
                        {Number(l.valorRecuperado) > 0 && <div className="text-xs text-tenue">recuperado {formatearPesos(l.valorRecuperado)}</div>}
                      </td>
                      <td className={`num ${Number(l.diferenciaCantidad) > 0 ? "text-peligro" : Number(l.diferenciaCantidad) < 0 ? "text-exito" : ""}`}>
                        {formatearCantidad(l.diferenciaCantidad)}
                        <div className="text-xs">{formatearPesos(l.diferenciaValor)}</div>
                      </td>
                      {editable && db && (
                        <td className="whitespace-nowrap">
                          <details>
                            <summary className="cursor-pointer text-xs text-primario">Editar</summary>
                            <div className="absolute left-4 right-4 z-20 mt-1 rounded-lg border border-borde bg-superficie p-3 shadow-lg">
                              <FormularioConsumo
                                accion={accion}
                                materiales={materiales}
                                etapas={etapas}
                                textoBoton="Guardar"
                                kardex={db._count.movimientos > 0}
                                inicial={{
                                  id: db.id,
                                  materialId: db.materialId,
                                  etapaId: db.etapaId,
                                  cantidadRequerida: db.cantidadRequerida.toString(),
                                  cantidadEntregada: txt(db.cantidadEntregada),
                                  cantidadUtilizada: db.cantidadUtilizada.toString(),
                                  cantidadDevuelta: db.cantidadDevuelta.toString(),
                                  causaMerma: db.causaMerma,
                                  costoUnitario: db.costoUnitarioAplicado.toString(),
                                  clasificacionMerma: db.clasificacionMerma,
                                  disposicionMerma: db.disposicionMerma,
                                  valorRecuperado: db.valorRecuperado.toString(),
                                }}
                              />
                            </div>
                          </details>
                          {db._count.movimientos > 0 && (
                            puedeInventario && (
                              <details>
                                <summary className="cursor-pointer text-xs text-primario">Devolver al almacén</summary>
                                <div className="absolute left-4 right-4 z-20 mt-1 rounded-lg border border-borde bg-superficie p-3 shadow-lg">
                                  <FormularioAccion accion={accionDevolucion.bind(null, orden.id)} reiniciar className="grid items-end gap-3 sm:grid-cols-5">
                                    <input type="hidden" name="consumoId" value={db.id} />
                                    <Campo etiqueta="Fecha">
                                      <Entrada type="date" name="fecha" required defaultValue={hoyBogota()} />
                                    </Campo>
                                    <Campo etiqueta={`Cantidad (${l.unidad})`}>
                                      <Entrada name="cantidad" inputMode="decimal" required />
                                    </Campo>
                                    <Campo etiqueta="Quién devuelve">
                                      <Entrada name="solicitante" />
                                    </Campo>
                                    <Campo etiqueta="Documento">
                                      <Entrada name="documento" placeholder="N.º de devolución" />
                                    </Campo>
                                    <Boton>Registrar devolución</Boton>
                                  </FormularioAccion>
                                  <p className="mt-2 text-xs text-tenue">Se valora al costo con que salió hacia la orden ({formatearPesos(l.costoUnitario)}).</p>
                                </div>
                              </details>
                            )
                          )}
                          <EliminarLinea
                            ordenId={orden.id}
                            tipo="material"
                            lineaId={db.id}
                            confirmar={
                              db._count.movimientos > 0 && d(l.entregada).minus(d(l.devuelta)).greaterThan(0)
                                ? `¿Eliminar esta línea? Las ${formatearCantidad(d(l.entregada).minus(d(l.devuelta)))} ${l.unidad ?? "unidades"} pendientes se devolverán automáticamente al almacén. Los movimientos quedan en el kárdex como historial.`
                                : "¿Eliminar esta línea de material?"
                            }
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={9}>Totales</td>
                  <td className="num">{formatearPesos(m.costoMaterialesDirectos)}</td>
                  <td className="num">{formatearPesos(m.costoMermas)}</td>
                  <td className="num">{formatearPesos(m.diferenciaValorTotal)}</td>
                  {editable && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>Materiales directos: <strong>{formatearPesos(m.costoMaterialesDirectos)}</strong></div>
          <div>Mermas (línea propia, no incluidas en materiales): <strong>{formatearPesos(m.costoMermas)}</strong></div>
          {(["NORMAL", "ANORMAL", "RECUPERABLE", "SIN_CLASIFICAR"] as const)
            .filter((c) => Number(m.mermasPorClase[c]) > 0)
            .map((c) => (
              <div key={c} className="text-tenue">
                Merma {NOMBRE_CLASIFICACION_MERMA[c].toLowerCase()}: {formatearPesos(m.mermasPorClase[c])}
              </div>
            ))}
          {Number(resumen.perdidaMermaAnormal) > 0 && (
            <div className="text-advertencia">
              Merma anormal llevada a pérdida del período (no incluida en el costo): <strong>{formatearPesos(resumen.perdidaMermaAnormal)}</strong>
            </div>
          )}
          {resumen.mostrarCostoEstimadoMateriales && (
            <div>Costo estimado de materiales (lista técnica): <strong>{formatearPesos(m.costoEstimado)}</strong></div>
          )}
        </dl>
      </Tarjeta>
      {puedeInventario && (
        <Tarjeta titulo="Requisición de almacén (salida a la orden)">
          <FormularioAccion accion={accionRequisicion.bind(null, orden.id)} reiniciar className="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Campo etiqueta="Material" className="sm:col-span-2">
              <Selector name="materialId" required>
                <option value="">— Seleccione —</option>
                {materiales.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.codigo} · {x.descripcion} ({x.unidad})
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Fecha">
              <Entrada type="date" name="fecha" required defaultValue={hoyBogota()} />
            </Campo>
            <Campo etiqueta="Cantidad">
              <Entrada name="cantidad" inputMode="decimal" required />
            </Campo>
            <Campo etiqueta="Solicitante">
              <Entrada name="solicitante" required />
            </Campo>
            <Campo etiqueta="N.º de requisición">
              <Entrada name="documento" />
            </Campo>
            <Boton>Registrar salida</Boton>
          </FormularioAccion>
          <p className="mt-2 text-xs text-tenue">
            La salida se valora al costo promedio ponderado del kárdex y se suma a la cantidad entregada de la línea del material (se crea si no existe). Queda registrado quién
            la autorizó.
          </p>
        </Tarjeta>
      )}
      {editable && (
        <Tarjeta titulo="Agregar material">
          <FormularioConsumo accion={accion} materiales={materiales} etapas={etapas} textoBoton="Agregar" />
        </Tarjeta>
      )}
    </div>
  );
}
