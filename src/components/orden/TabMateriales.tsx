import { prisma } from "@/lib/db";
import { formatearCantidad, formatearPesos, formatearPorcentaje } from "@/lib/costeo";
import type { OrdenCompleta, ResumenSerializado } from "@/lib/servicios/ordenes";
import { CATEGORIAS_MATERIAL } from "@/lib/servicios/catalogos";
import { txt } from "@/lib/servicios/util";
import { Tarjeta, Vacio } from "@/components/ui";
import { FormularioConsumo } from "./FormularioConsumo";
import { NuevoMaterial } from "./NuevoMaterial";
import { EliminarLinea } from "./EliminarLinea";
import { accionGuardarConsumo } from "@/app/(app)/ordenes/acciones";

export async function TabMateriales({ orden, resumen, editable }: { orden: OrdenCompleta; resumen: ResumenSerializado; editable: boolean }) {
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
                      </td>
                      <td>{l.unidad}</td>
                      <td className="num">{formatearCantidad(l.requerida)}</td>
                      <td className="num">{l.entregadaRegistrada ? formatearCantidad(l.entregada) : <span className="text-tenue">—</span>}</td>
                      <td className="num">{formatearCantidad(l.utilizada)}</td>
                      <td className="num">{formatearCantidad(l.devuelta)}</td>
                      <td className="num">
                        {formatearCantidad(l.merma)}
                        {Number(l.merma) > 0 && <div className="text-xs text-tenue">{formatearPorcentaje(l.mermaPct)}</div>}
                      </td>
                      <td className="num">{formatearPesos(l.costoUnitario)}</td>
                      <td className="num">{formatearPesos(l.costoLinea)}</td>
                      <td className="num">{formatearPesos(l.costoMerma)}</td>
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
                                }}
                              />
                            </div>
                          </details>
                          <EliminarLinea ordenId={orden.id} tipo="material" lineaId={db.id} />
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
          {resumen.mostrarCostoEstimadoMateriales && (
            <div>Costo estimado de materiales (lista técnica): <strong>{formatearPesos(m.costoEstimado)}</strong></div>
          )}
        </dl>
      </Tarjeta>
      {editable && (
        <Tarjeta titulo="Agregar material">
          <FormularioConsumo accion={accion} materiales={materiales} etapas={etapas} textoBoton="Agregar" />
        </Tarjeta>
      )}
    </div>
  );
}
