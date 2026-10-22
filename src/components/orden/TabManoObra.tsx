import { prisma } from "@/lib/db";
import { tiene, type UsuarioActual } from "@/lib/auth/permisos";
import { formatearCantidad, formatearFecha, formatearPesos } from "@/lib/costeo";
import type { OrdenCompleta, ResumenSerializado } from "@/lib/servicios/ordenes";
import { trabajadoresConTarifas } from "@/lib/servicios/trabajadores";
import { aISO } from "@/lib/servicios/util";
import { Tarjeta, Vacio } from "@/components/ui";
import { FormularioMOD } from "./FormularioMOD";
import { EliminarLinea } from "./EliminarLinea";
import { accionGuardarMOD } from "@/app/(app)/ordenes/acciones";

export async function TabManoObra({ orden, resumen, usuario, editable }: { orden: OrdenCompleta; resumen: ResumenSerializado; usuario: UsuarioActual; editable: boolean }) {
  const trabajadores = (await trabajadoresConTarifas(prisma)).filter((t) => t.tipo !== "INGENIERIA");
  const puedeEditarTarifa = tiene(usuario, "tarifas.editarEnRegistro");
  const accion = accionGuardarMOD.bind(null, orden.id);
  const mod = resumen.mod;

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Mano de obra directa (fabricación)" className="relative">
        {mod.registros.length === 0 ? (
          <Vacio>Sin registros de mano de obra.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Trabajador / cargo</th>
                  <th>Actividad</th>
                  <th className="num">Horas</th>
                  <th className="num">Tarifa</th>
                  <th className="num">Costo</th>
                  {editable && <th />}
                </tr>
              </thead>
              <tbody>
                {mod.registros.map((r) => {
                  const db = orden.registrosMOD.find((x) => x.id === r.id);
                  return (
                    <tr key={r.id}>
                      <td>{formatearFecha(r.fecha)}</td>
                      <td>{r.trabajador}</td>
                      <td>{r.actividad}</td>
                      <td className="num">{formatearCantidad(r.horas)}</td>
                      <td className="num">{formatearPesos(r.tarifa)}</td>
                      <td className="num">{formatearPesos(r.costo)}</td>
                      {editable && db && (
                        <td className="whitespace-nowrap">
                          <details>
                            <summary className="cursor-pointer text-xs text-primario">Editar</summary>
                            <div className="absolute left-4 right-4 z-20 mt-1 rounded-lg border border-borde bg-superficie p-3 shadow-lg">
                              <FormularioMOD
                                accion={accion}
                                trabajadores={trabajadores}
                                puedeEditarTarifa={puedeEditarTarifa}
                                textoBoton="Guardar"
                                inicial={{
                                  id: db.id,
                                  trabajadorId: db.trabajadorId,
                                  cargo: db.cargo,
                                  actividad: db.actividad,
                                  fecha: aISO(db.fecha)!,
                                  horas: db.horas.toString(),
                                  tarifa: db.tarifaAplicada.toString(),
                                }}
                              />
                            </div>
                          </details>
                          <EliminarLinea ordenId={orden.id} tipo="mod" lineaId={db.id} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Totales</td>
                  <td className="num">{formatearCantidad(mod.horasMOD)}</td>
                  <td />
                  <td className="num">{formatearPesos(mod.costoMOD)}</td>
                  {editable && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>Materiales directos: <strong>{formatearPesos(resumen.elementos.materialesDirectos)}</strong></div>
          <div>Mano de obra directa: <strong>{formatearPesos(mod.costoMOD)}</strong></div>
          <div>Costo directo total: <strong>{formatearPesos(resumen.costoDirecto)}</strong></div>
        </dl>
      </Tarjeta>
      {editable && (
        <Tarjeta titulo="Registrar mano de obra">
          <FormularioMOD accion={accion} trabajadores={trabajadores} puedeEditarTarifa={puedeEditarTarifa} textoBoton="Agregar" />
        </Tarjeta>
      )}
    </div>
  );
}
