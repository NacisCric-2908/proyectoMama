"use client";

import { FormularioAccion } from "@/components/FormularioAccion";
import { accionEliminarLinea } from "@/app/(app)/ordenes/acciones";

export function EliminarLinea({
  ordenId,
  tipo,
  lineaId,
  confirmar = "¿Eliminar este registro?",
}: {
  ordenId: string;
  tipo: "material" | "mod" | "ingenieria" | "servicio";
  lineaId: string;
  confirmar?: string;
}) {
  return (
    <FormularioAccion accion={accionEliminarLinea.bind(null, ordenId)} confirmar={confirmar}>
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="lineaId" value={lineaId} />
      <button className="text-xs text-peligro hover:underline">Eliminar</button>
    </FormularioAccion>
  );
}
