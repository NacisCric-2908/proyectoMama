"use client";

import { useRef } from "react";
import { FormularioAccion } from "@/components/FormularioAccion";
import { Boton, Campo, Entrada, Selector } from "@/components/ui";
import { accionGuardarMaterial } from "@/app/(app)/catalogos-acciones";

/** Modal para crear un material en el catálogo sin salir de la orden. */
export function NuevoMaterial({ categorias }: { categorias: string[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Boton type="button" variante="secundario" onClick={() => ref.current?.showModal()}>
        + Nuevo material en catálogo
      </Boton>
      <dialog ref={ref} className="m-auto w-full max-w-lg rounded-lg border border-borde p-0 backdrop:bg-black/30">
        <div className="p-4">
          <h2 className="mb-3 font-semibold">Nuevo material</h2>
          <FormularioAccion accion={accionGuardarMaterial} reiniciar alExito={() => setTimeout(() => ref.current?.close(), 600)} className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Código">
              <Entrada name="codigo" required />
            </Campo>
            <Campo etiqueta="Unidad de medida">
              <Entrada name="unidad" required placeholder="und, m, kg…" />
            </Campo>
            <Campo etiqueta="Descripción" className="sm:col-span-2">
              <Entrada name="descripcion" required />
            </Campo>
            <Campo etiqueta="Categoría">
              <Selector name="categoria" required>
                {categorias.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Selector>
            </Campo>
            <Campo etiqueta="Costo unitario de referencia">
              <Entrada name="costoReferencia" inputMode="decimal" required />
            </Campo>
            <div className="flex gap-2 sm:col-span-2">
              <Boton>Crear material</Boton>
              <Boton type="button" variante="secundario" onClick={() => ref.current?.close()}>
                Cerrar
              </Boton>
            </div>
          </FormularioAccion>
        </div>
      </dialog>
    </>
  );
}
