import type { AsignacionCIF } from "@prisma/client";
import { BASES_CIF, formatearCantidad, formatearFecha, formatearPesos, type BaseCIF } from "@/lib/costeo";
import type { ResumenSerializado } from "@/lib/servicios/ordenes";
import type { estadoCIF } from "@/lib/servicios/cif";
import { FormularioAccion } from "@/components/FormularioAccion";
import { Boton, Campo, Entrada, Selector, Tarjeta } from "@/components/ui";
import { accionAsignarCIF } from "@/app/(app)/ordenes/acciones";

function tasaTexto(base: BaseCIF, tasa: string) {
  return BASES_CIF[base].esPorcentaje ? `${formatearCantidad(tasa)} %` : `${formatearPesos(tasa)} ${BASES_CIF[base].unidadTasa.replace("$ ", "")}`;
}

export function TabCIF({
  ordenId,
  resumen,
  cif,
  asignacion,
  puedeAsignar,
}: {
  ordenId: string;
  resumen: ResumenSerializado;
  cif: Awaited<ReturnType<typeof estadoCIF>>;
  asignacion: AsignacionCIF | null;
  puedeAsignar: boolean;
}) {
  const r = resumen.cif;
  const accion = accionAsignarCIF.bind(null, ordenId);
  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Costos indirectos de fabricación asignados">
        {r ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-tenue">Base de asignación</dt>
              <dd className="font-medium">{r.nombreBase}</dd>
            </div>
            <div>
              <dt className="text-tenue">Cantidad de la base</dt>
              <dd className="font-medium">{BASES_CIF[r.base].esPorcentaje ? formatearPesos(r.cantidadBase) : formatearCantidad(r.cantidadBase)}</dd>
            </div>
            <div>
              <dt className="text-tenue">Tasa aplicada</dt>
              <dd className="font-medium">{tasaTexto(r.base, r.tasa)}</dd>
            </div>
            <div>
              <dt className="text-tenue">CIF asignado</dt>
              <dd className="text-lg font-semibold">{formatearPesos(r.valor)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-advertencia">La orden aún no tiene CIF asignado. Es obligatorio para cerrarla.</p>
        )}
        {asignacion && (
          <p className="mt-3 text-xs text-tenue">
            Período {asignacion.periodo} · asignado el {formatearFecha(asignacion.fecha)}
            {asignacion.justificacionCambioBase && <> · Justificación: {asignacion.justificacionCambioBase}</>}
          </p>
        )}
      </Tarjeta>

      <Tarjeta titulo={`Parámetro del período ${cif.periodo}`}>
        {cif.parametro ? (
          <p className="text-sm">
            Base: <strong>{cif.parametro.nombreBase}</strong> · Tasa: <strong>{cif.parametro.tasa ? tasaTexto(cif.parametro.base, cif.parametro.tasa) : "—"}</strong>
            {cif.parametro.detalle && <span className="text-tenue"> ({cif.parametro.detalle})</span>}
          </p>
        ) : (
          <p className="text-sm text-advertencia">No hay parámetros de CIF configurados para este período. El contador debe configurarlos en el módulo CIF.</p>
        )}
        {cif.error && <p className="text-sm text-peligro">{cif.error}</p>}
        {cif.desactualizado && (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
            ⚠️ El parámetro del período cambió después de asignar el CIF a esta orden.
          </p>
        )}
        {puedeAsignar && cif.parametro && (
          <FormularioAccion accion={accion} className="mt-3">
            <Boton>{asignacion ? "Recalcular CIF" : "Asignar CIF del período"}</Boton>
          </FormularioAccion>
        )}
      </Tarjeta>

      {puedeAsignar && (
        <Tarjeta titulo="Usar otra base o tasa en esta orden">
          <FormularioAccion accion={accion} className="grid items-end gap-3 sm:grid-cols-4">
            <Campo etiqueta="Base de asignación">
              <Selector name="base" required>
                {Object.entries(BASES_CIF).map(([k, b]) => (
                  <option key={k} value={k}>
                    {b.nombre} ({b.unidadTasa})
                  </option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Tasa">
              <Entrada name="tasa" inputMode="decimal" required />
            </Campo>
            <Campo etiqueta="Justificación" className="sm:col-span-2">
              <Entrada name="justificacion" required />
            </Campo>
            <div>
              <Boton variante="secundario">Aplicar a esta orden</Boton>
            </div>
          </FormularioAccion>
        </Tarjeta>
      )}
    </div>
  );
}
