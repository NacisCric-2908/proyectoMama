import type { ExplicacionDesviacion } from "@prisma/client";
import { formatearCantidad, formatearFecha, formatearPesos, formatearPorcentaje, type ComparacionPresupuesto as Comparacion, type FilaComparacion } from "@/lib/costeo";
import { CAUSAS_DESVIACION } from "@/lib/servicios/desviaciones";
import { FormularioAccion } from "@/components/FormularioAccion";
import { AreaTexto, Boton, Campo, Entrada, Selector } from "@/components/ui";
import { accionExplicarDesviacion } from "@/app/(app)/ordenes/acciones";

export interface OpcionesExplicacion {
  ordenId: string;
  presupuestoId: string;
  explicaciones: ExplicacionDesviacion[];
  puede: boolean;
}

const colorSigno = (f: Pick<FilaComparacion, "signo">) => (f.signo === "MAYOR" ? "text-peligro" : f.signo === "MENOR" ? "text-exito" : "");
const textoSigno = { MAYOR: "Sobrecosto", MENOR: "Ahorro", IGUAL: "Sin diferencia" } as const;

/** Presupuesto vs costo acumulado por componente: monto y signo de cada diferencia (D11) y horas (Q14). */
export function ComparacionPresupuesto({ c, titulo, explicar }: { c: Comparacion; titulo: string; explicar?: OpcionesExplicacion }) {
  const explicacion = (clave: string) => explicar?.explicaciones.find((e) => e.presupuestoId === explicar.presupuestoId && e.componente === clave);
  const sinExplicar = explicar ? [...c.filas, c.total].filter((f) => f.signo !== "IGUAL" && !explicacion(f.clave)).length : 0;
  return (
    <div className="relative flex flex-col gap-3">
      {explicar && sinExplicar > 0 && (
        <p className="text-sm text-advertencia">
          {sinExplicar} {sinExplicar === 1 ? "diferencia sin explicación documentada" : "diferencias sin explicación documentada"}.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Concepto</th>
              <th className="num">{titulo}</th>
              <th className="num">Costo acumulado</th>
              <th className="num">Diferencia</th>
              <th className="num">%</th>
              <th>Signo</th>
              {explicar && <th>Explicación documentada</th>}
            </tr>
          </thead>
          <tbody>
            {[...c.filas, c.total].map((f) => (
              <tr key={f.clave} className={f.clave === "total" ? "font-semibold" : ""}>
                <td>{f.concepto}</td>
                <td className="num">{formatearPesos(f.presupuesto)}</td>
                <td className="num">{formatearPesos(f.real)}</td>
                <td className={`num ${colorSigno(f)}`}>{formatearPesos(f.diferencia)}</td>
                <td className={`num ${colorSigno(f)}`}>{f.pct ? formatearPorcentaje(f.pct) : "—"}</td>
                <td className={colorSigno(f)}>{textoSigno[f.signo]}</td>
                {explicar && (
                  <td className="min-w-56 text-xs">
                    {(() => {
                      const e = explicacion(f.clave);
                      return (
                        <>
                          {e && (
                            <div>
                              <strong>{CAUSAS_DESVIACION[e.causa]}</strong> (causa declarada): {e.explicacion}
                              {e.soporte && <span className="text-tenue"> · Soporte: {e.soporte}</span>}
                              <div className="text-tenue">
                                {e.usuarioNombre}, {formatearFecha(e.fecha)} · diferencia al explicar {formatearPesos(e.diferencia.toString())}
                              </div>
                            </div>
                          )}
                          {explicar.puede && f.signo !== "IGUAL" && (
                            <details>
                              <summary className="cursor-pointer text-primario">{e ? "Actualizar" : "Explicar"}</summary>
                              <div className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-borde bg-superficie p-3 shadow-lg">
                                <FormularioAccion accion={accionExplicarDesviacion.bind(null, explicar.ordenId)} className="grid items-end gap-3 sm:grid-cols-3">
                                  <input type="hidden" name="presupuestoId" value={explicar.presupuestoId} />
                                  <input type="hidden" name="componente" value={f.clave} />
                                  <Campo etiqueta={`Causa declarada · ${f.concepto}`}>
                                    <Selector name="causa" defaultValue={e?.causa}>
                                      {Object.entries(CAUSAS_DESVIACION).map(([k, v]) => (
                                        <option key={k} value={k}>
                                          {v}
                                        </option>
                                      ))}
                                    </Selector>
                                  </Campo>
                                  <Campo etiqueta="Soporte (documento)">
                                    <Entrada name="soporte" defaultValue={e?.soporte ?? ""} placeholder="Factura, acta de cambio…" />
                                  </Campo>
                                  <Campo etiqueta="Explicación" className="sm:col-span-3">
                                    <AreaTexto name="explicacion" required defaultValue={e?.explicacion} />
                                  </Campo>
                                  <Boton>Guardar explicación</Boton>
                                </FormularioAccion>
                              </div>
                            </details>
                          )}
                        </>
                      );
                    })()}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <table className="tabla max-w-xl">
        <thead>
          <tr>
            <th>Horas</th>
            <th className="num">Estimadas</th>
            <th className="num">Registradas</th>
            <th className="num">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {c.horas.map((h) => (
            <tr key={h.concepto}>
              <td>{h.concepto}</td>
              <td className="num">{formatearCantidad(h.estimadas)}</td>
              <td className="num">{formatearCantidad(h.reales)}</td>
              <td className={`num ${colorSigno(h)}`}>{formatearCantidad(h.diferencia)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
