"use client";

import { useState } from "react";
import { d, ErrorCosteo, formatearPesos, hoyBogota, validarRegistroIngenieria } from "@/lib/costeo";
import type { ResultadoAccion } from "@/lib/acciones";
import { FormularioAccion } from "@/components/FormularioAccion";
import { AreaTexto, Boton, Campo, Entrada, Selector } from "@/components/ui";
import { tarifaEnFecha, type TrabajadorConTarifas } from "./tarifas-cliente";

export interface ValoresIngenieria {
  id?: string;
  etapaId?: string;
  responsableId?: string;
  fechaInicio?: string;
  fechaFin?: string;
  horas?: string;
  costoHora?: string;
  descripcion?: string;
  observacionesTecnicas?: string | null;
}

export function FormularioIngenieria({
  accion,
  etapas,
  trabajadores,
  puedeEditarTarifa,
  inicial = {},
  textoBoton,
  ocultarTarifa = false,
}: {
  accion: (p: ResultadoAccion | null, fd: FormData) => Promise<ResultadoAccion>;
  etapas: { id: string; nombre: string }[];
  trabajadores: TrabajadorConTarifas[];
  puedeEditarTarifa: boolean;
  inicial?: ValoresIngenieria;
  textoBoton: string;
  ocultarTarifa?: boolean;
}) {
  const hoy = hoyBogota();
  const [v, setV] = useState<ValoresIngenieria>({
    fechaInicio: hoy,
    fechaFin: hoy,
    responsableId: trabajadores.length === 1 ? trabajadores[0].id : undefined,
    ...inicial,
  });
  const vigente = tarifaEnFecha(trabajadores.find((t) => t.id === v.responsableId), v.fechaInicio ?? "");
  const tarifa = puedeEditarTarifa && v.costoHora ? v.costoHora : vigente || v.costoHora || "";
  const cambiar = (k: keyof ValoresIngenieria) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value });

  let error: string | null = null;
  let advertencia: string | null = null;
  let costo: string | null = null;
  if (v.horas) {
    try {
      advertencia = validarRegistroIngenieria({
        etapaId: v.etapaId ?? "",
        horas: v.horas.replace(",", "."),
        costoHora: (tarifa || "0").replace(",", "."),
        fechaInicio: v.fechaInicio,
        fechaFin: v.fechaFin,
      });
      if (tarifa) costo = formatearPesos(d(v.horas.replace(",", ".")).times(d(tarifa.replace(",", "."))));
    } catch (e) {
      error = e instanceof ErrorCosteo ? e.message : "Valores inválidos";
    }
  }

  return (
    <FormularioAccion
      accion={accion}
      reiniciar={!inicial.id}
      alExito={() => !inicial.id && setV({ fechaInicio: v.fechaInicio, fechaFin: v.fechaFin, responsableId: v.responsableId, etapaId: v.etapaId })}
      className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6"
    >
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
      <Campo etiqueta="Etapa">
        <Selector name="etapaId" required value={v.etapaId ?? ""} onChange={cambiar("etapaId")}>
          <option value="">— Seleccione —</option>
          {etapas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Responsable">
        <Selector name="responsableId" required value={v.responsableId ?? ""} onChange={cambiar("responsableId")}>
          {trabajadores.length > 1 && <option value="">— Seleccione —</option>}
          {trabajadores.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} ({t.cargo})
            </option>
          ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Fecha de inicio">
        <Entrada type="date" name="fechaInicio" required value={v.fechaInicio ?? ""} onChange={cambiar("fechaInicio")} />
      </Campo>
      <Campo etiqueta="Fecha de finalización">
        <Entrada type="date" name="fechaFin" required value={v.fechaFin ?? ""} onChange={cambiar("fechaFin")} />
      </Campo>
      <Campo etiqueta="Horas dedicadas">
        <Entrada name="horas" inputMode="decimal" required value={v.horas ?? ""} onChange={cambiar("horas")} />
      </Campo>
      {!ocultarTarifa && (
        <Campo etiqueta="Costo hora" ayuda={puedeEditarTarifa ? "Prellenado con la tarifa vigente" : "Tarifa vigente"}>
          <Entrada
            name="costoHora"
            inputMode="decimal"
            value={puedeEditarTarifa ? v.costoHora ?? vigente : vigente}
            readOnly={!puedeEditarTarifa}
            onChange={cambiar("costoHora")}
          />
        </Campo>
      )}
      <Campo etiqueta="Descripción de la actividad" className="sm:col-span-3">
        <AreaTexto name="descripcion" required value={v.descripcion ?? ""} onChange={cambiar("descripcion")} />
      </Campo>
      <Campo etiqueta="Observaciones técnicas" className="sm:col-span-3">
        <AreaTexto name="observacionesTecnicas" value={v.observacionesTecnicas ?? ""} onChange={cambiar("observacionesTecnicas")} />
      </Campo>
      <div className="flex flex-wrap items-end gap-3 text-sm sm:col-span-3 lg:col-span-6">
        {error && <span className="text-peligro">{error}</span>}
        {advertencia && <span className="text-advertencia">⚠️ {advertencia}</span>}
        {!ocultarTarifa && costo && !error && <span>Costo: <strong>{costo}</strong></span>}
        <Boton disabled={!!error}>{textoBoton}</Boton>
      </div>
    </FormularioAccion>
  );
}
