"use client";

import { useState } from "react";
import { calcularLineaMaterial, formatearCantidad, formatearPesos, ErrorCosteo } from "@/lib/costeo";
import type { ResultadoAccion } from "@/lib/acciones";
import { FormularioAccion } from "@/components/FormularioAccion";
import { Boton, Campo, Entrada, Selector } from "@/components/ui";

export interface MaterialCatalogo {
  id: string;
  codigo: string;
  descripcion: string;
  unidad: string;
  costo: string;
}

export interface ValoresConsumo {
  id?: string;
  materialId?: string;
  etapaId?: string | null;
  cantidadRequerida?: string;
  cantidadEntregada?: string | null;
  cantidadUtilizada?: string;
  cantidadDevuelta?: string;
  causaMerma?: string | null;
  costoUnitario?: string;
}

/** Formulario de línea de material con cálculo en vivo (merma, costo, diferencia vs lista técnica). */
export function FormularioConsumo({
  accion,
  materiales,
  etapas,
  inicial = {},
  textoBoton,
}: {
  accion: (p: ResultadoAccion | null, fd: FormData) => Promise<ResultadoAccion>;
  materiales: MaterialCatalogo[];
  etapas: { id: string; nombre: string }[];
  inicial?: ValoresConsumo;
  textoBoton: string;
}) {
  const [v, setV] = useState<ValoresConsumo>(inicial);
  const material = materiales.find((m) => m.id === v.materialId);
  const costo = v.costoUnitario || material?.costo || "0";
  const cambiar = (k: keyof ValoresConsumo) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  let vista: ReturnType<typeof calcularLineaMaterial> | null = null;
  let error: string | null = null;
  try {
    vista = calcularLineaMaterial({
      descripcion: material?.descripcion ?? "",
      requerida: v.cantidadRequerida?.replace(",", ".") || 0,
      entregada: v.cantidadEntregada ? v.cantidadEntregada.replace(",", ".") : null,
      utilizada: v.cantidadUtilizada?.replace(",", ".") || 0,
      devuelta: v.cantidadDevuelta?.replace(",", ".") || 0,
      costoUnitario: costo.replace(",", "."),
    });
  } catch (e) {
    error = e instanceof ErrorCosteo ? e.message : "Valores inválidos";
  }

  return (
    <FormularioAccion accion={accion} reiniciar={!inicial.id} alExito={() => !inicial.id && setV({})} className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
      <Campo etiqueta="Material" className="sm:col-span-2">
        <Selector name="materialId" required value={v.materialId ?? ""} onChange={cambiar("materialId")}>
          <option value="">— Seleccione —</option>
          {materiales.map((m) => (
            <option key={m.id} value={m.id}>
              {m.codigo} · {m.descripcion} ({m.unidad})
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Etapa asociada">
        <Selector name="etapaId" value={v.etapaId ?? ""} onChange={cambiar("etapaId")}>
          <option value="">— Ninguna —</option>
          {etapas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Requerida">
        <Entrada name="cantidadRequerida" inputMode="decimal" value={v.cantidadRequerida ?? ""} onChange={cambiar("cantidadRequerida")} />
      </Campo>
      <Campo etiqueta="Entregada" ayuda="Vacío = igual a la utilizada">
        <Entrada name="cantidadEntregada" inputMode="decimal" value={v.cantidadEntregada ?? ""} onChange={cambiar("cantidadEntregada")} />
      </Campo>
      <Campo etiqueta="Utilizada">
        <Entrada name="cantidadUtilizada" inputMode="decimal" value={v.cantidadUtilizada ?? ""} onChange={cambiar("cantidadUtilizada")} />
      </Campo>
      <Campo etiqueta="Devuelta">
        <Entrada name="cantidadDevuelta" inputMode="decimal" value={v.cantidadDevuelta ?? ""} onChange={cambiar("cantidadDevuelta")} />
      </Campo>
      <Campo etiqueta="Costo unitario" ayuda={inicial.id ? "Costo aplicado a esta orden" : "Vacío = costo del catálogo"}>
        <Entrada name="costoUnitario" inputMode="decimal" value={v.costoUnitario ?? ""} placeholder={material?.costo} onChange={cambiar("costoUnitario")} />
      </Campo>
      <Campo etiqueta="Causa de la merma" className="sm:col-span-2">
        <Entrada name="causaMerma" value={v.causaMerma ?? ""} onChange={cambiar("causaMerma")} />
      </Campo>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1 text-sm sm:col-span-4 lg:col-span-5">
        {error ? (
          <span className="text-peligro">{error}</span>
        ) : (
          vista && (
            <>
              <span>Merma: <strong>{formatearCantidad(vista.merma)}</strong></span>
              <span>Costo: <strong>{formatearPesos(vista.costoLinea)}</strong></span>
              <span>Costo merma: <strong>{formatearPesos(vista.costoMerma)}</strong></span>
              <span>Dif. vs lista técnica: <strong>{formatearCantidad(vista.diferenciaCantidad)}</strong> ({formatearPesos(vista.diferenciaValor)})</span>
            </>
          )
        )}
      </div>
      <div className="flex items-end">
        <Boton disabled={!!error}>{textoBoton}</Boton>
      </div>
    </FormularioAccion>
  );
}
