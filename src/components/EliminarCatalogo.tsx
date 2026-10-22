"use client";

import { FormularioAccion } from "@/components/FormularioAccion";
import { accionEliminarCatalogo } from "@/app/(app)/catalogos-acciones";

export function EliminarCatalogo({ tipo, id }: { tipo: "cliente" | "material" | "trabajador"; id: string }) {
  return (
    <FormularioAccion accion={accionEliminarCatalogo} confirmar="¿Eliminar este registro? Se conserva en el historial (borrado lógico).">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="id" value={id} />
      <button className="text-xs text-peligro hover:underline">Eliminar</button>
    </FormularioAccion>
  );
}
