import { tiene, type UsuarioActual } from "@/lib/auth/permisos";
import { BASES_CIF, CONCEPTOS, elegirPresupuestos, esEditable, formatearCantidad, formatearFecha, formatearPesos, totalPresupuesto, type EstadoOrden } from "@/lib/costeo";
import type { OrdenCompleta, ResumenSerializado } from "@/lib/servicios/ordenes";
import { componentesDe } from "@/lib/servicios/presupuestos";
import { FormularioAccion } from "@/components/FormularioAccion";
import { Boton, Tarjeta, Vacio } from "@/components/ui";
import { FormularioPresupuesto } from "./FormularioPresupuesto";
import { accionAprobarPresupuesto, accionCrearPresupuesto } from "@/app/(app)/ordenes/acciones";

export function TabPresupuesto({ orden, resumen, usuario }: { orden: OrdenCompleta; resumen: ResumenSerializado; usuario: UsuarioActual }) {
  const abierta = esEditable(orden.estado as EstadoOrden);
  const puedeRegistrar = abierta && tiene(usuario, "ordenes.editar");
  const puedeAprobar = abierta && tiene(usuario, "presupuesto.aprobar");
  const { original, vigente } = elegirPresupuestos(orden.presupuestos);
  const ultima = orden.presupuestos[orden.presupuestos.length - 1];
  const base = ultima ? componentesDe(ultima) : { materialesDirectos: resumen.materiales.costoEstimado };
  const sugerencias = [
    `Materiales según la lista técnica de la orden: ${formatearPesos(resumen.materiales.costoEstimado)}.`,
    orden.asignacionCIF
      ? `CIF: base ${BASES_CIF[orden.asignacionCIF.base].nombre}, tasa ${formatearCantidad(orden.asignacionCIF.tasaAplicada.toString())} (${BASES_CIF[orden.asignacionCIF.base].unidadTasa}). Multiplique por la base estimada.`
      : "La orden aún no tiene tasa de CIF asignada.",
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Versiones del presupuesto de costo">
        <p className="mb-3 text-sm text-tenue">
          El presupuesto es la estimación previa del costo por componente. La versión 1 aprobada es el presupuesto original; los cambios de especificación se registran como
          nuevas versiones con su motivo. Solo las versiones aprobadas se comparan con el costo acumulado.
        </p>
        {orden.presupuestos.length === 0 ? (
          <Vacio>La orden no tiene presupuesto de costo.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Versión</th>
                  {CONCEPTOS.map((c) => (
                    <th key={c.clave} className="num">
                      {c.nombre}
                    </th>
                  ))}
                  <th className="num">Total</th>
                  <th className="num">Horas ens. / ing.</th>
                  <th>Registro</th>
                  <th>Aprobación</th>
                </tr>
              </thead>
              <tbody>
                {orden.presupuestos.map((p) => {
                  const comp = componentesDe(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>v{p.version}</strong>
                        {p.id === original?.id && <div className="text-xs text-tenue">Original</div>}
                        {p.id === vigente?.id && <div className="text-xs text-exito">Vigente</div>}
                        {p.motivo && <div className="max-w-48 text-xs text-tenue">{p.motivo}</div>}
                      </td>
                      {CONCEPTOS.map((c) => (
                        <td key={c.clave} className="num">
                          {formatearPesos(comp[c.clave])}
                        </td>
                      ))}
                      <td className="num font-semibold">{formatearPesos(totalPresupuesto(comp))}</td>
                      <td className="num">
                        {formatearCantidad(comp.horasEnsamble)} / {formatearCantidad(comp.horasIngenieria)}
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {formatearFecha(p.creadoEn)}
                        <div className="text-tenue">{p.creadoPorNombre}</div>
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {p.aprobadoEn ? (
                          <>
                            Aprobada el {formatearFecha(p.aprobadoEn)}
                            <div className="text-tenue">{p.aprobadoPorNombre}</div>
                          </>
                        ) : puedeAprobar ? (
                          <FormularioAccion accion={accionAprobarPresupuesto.bind(null, orden.id)} confirmar={`¿Aprobar la versión ${p.version} del presupuesto?`}>
                            <input type="hidden" name="presupuestoId" value={p.id} />
                            <Boton variante="secundario">Aprobar</Boton>
                          </FormularioAccion>
                        ) : (
                          <span className="text-advertencia">Pendiente de aprobación</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
      {puedeRegistrar && (
        <Tarjeta titulo={orden.presupuestos.length ? `Registrar versión ${(ultima?.version ?? 0) + 1}` : "Registrar presupuesto original (versión 1)"}>
          <FormularioPresupuesto
            accion={accionCrearPresupuesto.bind(null, orden.id)}
            inicial={base as Record<string, string>}
            pideMotivo={orden.presupuestos.length > 0}
            sugerencias={sugerencias}
          />
        </Tarjeta>
      )}
    </div>
  );
}
