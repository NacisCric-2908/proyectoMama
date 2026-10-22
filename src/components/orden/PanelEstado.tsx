"use client";

import { useState } from "react";
import { NOMBRE_ESTADO, type EstadoOrden } from "@/lib/costeo";
import { FormularioAccion } from "@/components/FormularioAccion";
import { Boton, Campo, Entrada, Selector } from "@/components/ui";
import { accionCambiarEstado } from "@/app/(app)/ordenes/acciones";

export function PanelEstado({ ordenId, estado, destinos }: { ordenId: string; estado: EstadoOrden; destinos: EstadoOrden[] }) {
  const [destino, setDestino] = useState<EstadoOrden | "">("");
  if (!destinos.length) return null;
  const confirmacion =
    destino === "TERMINADO"
      ? "Al cerrar la orden se genera el informe de cierre, se congelan los valores y se bloquea la edición. ¿Continuar?"
      : destino === "ANULADO"
        ? "¿Anular la orden? Esta acción no se puede deshacer."
        : undefined;
  return (
    <details className="rounded-lg border border-borde bg-superficie p-3">
      <summary className="cursor-pointer text-sm font-medium">Cambiar estado (actual: {NOMBRE_ESTADO[estado]})</summary>
      <FormularioAccion accion={accionCambiarEstado.bind(null, ordenId)} confirmar={confirmacion} className="mt-3 grid items-end gap-3 sm:grid-cols-4">
        <Campo etiqueta="Nuevo estado">
          <Selector name="estado" required value={destino} onChange={(e) => setDestino(e.target.value as EstadoOrden)}>
            <option value="">— Seleccione —</option>
            {destinos.map((d) => (
              <option key={d} value={d}>
                {NOMBRE_ESTADO[d]}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo
          etiqueta={estado === "TERMINADO" && destino !== "FACTURADO" ? "Justificación (obligatoria)" : "Comentario"}
          ayuda="Obligatorio para retroceder, saltar etapas, anular o reabrir"
          className="sm:col-span-2"
        >
          <Entrada name="comentario" />
        </Campo>
        {destino === "FACTURADO" && (
          <>
            <Campo etiqueta="Número de factura">
              <Entrada name="numeroFactura" required />
            </Campo>
            <Campo etiqueta="Fecha de factura">
              <Entrada type="date" name="fechaFactura" required />
            </Campo>
          </>
        )}
        <div>
          <Boton variante={destino === "ANULADO" ? "peligro" : "primario"}>{destino === "TERMINADO" ? "Cerrar orden" : "Cambiar estado"}</Boton>
        </div>
      </FormularioAccion>
    </details>
  );
}
