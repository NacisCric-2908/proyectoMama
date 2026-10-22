"use client";

import { FormularioAccion } from "@/components/FormularioAccion";
import { Boton, Campo, Entrada } from "@/components/ui";
import { accionGuardarCliente } from "@/app/(app)/catalogos-acciones";

/** Crear un cliente sin salir de la orden. */
export function ClienteRapido() {
  return (
    <details className="rounded-lg border border-borde bg-superficie p-4">
      <summary className="cursor-pointer text-sm font-medium text-primario">+ Crear cliente nuevo</summary>
      <FormularioAccion accion={accionGuardarCliente} reiniciar className="mt-3 grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Nombre o razón social">
          <Entrada name="nombre" required />
        </Campo>
        <Campo etiqueta="NIT / cédula">
          <Entrada name="nit" />
        </Campo>
        <Campo etiqueta="Ciudad">
          <Entrada name="ciudad" />
        </Campo>
        <div>
          <Boton>Crear cliente</Boton>
        </div>
      </FormularioAccion>
    </details>
  );
}
