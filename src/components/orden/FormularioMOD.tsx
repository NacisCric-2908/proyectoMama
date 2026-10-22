"use client";

import { useState } from "react";
import { d, formatearPesos, hoyBogota } from "@/lib/costeo";
import type { ResultadoAccion } from "@/lib/acciones";
import { FormularioAccion } from "@/components/FormularioAccion";
import { Boton, Campo, Entrada, Selector } from "@/components/ui";
import { tarifaEnFecha, type TrabajadorConTarifas } from "./tarifas-cliente";

export interface ValoresMOD {
  id?: string;
  trabajadorId?: string | null;
  cargo?: string | null;
  actividad?: string;
  fecha?: string;
  horas?: string;
  tarifa?: string;
}

export function FormularioMOD({
  accion,
  trabajadores,
  puedeEditarTarifa,
  inicial = {},
  textoBoton,
  ocultarTarifa = false,
}: {
  accion: (p: ResultadoAccion | null, fd: FormData) => Promise<ResultadoAccion>;
  trabajadores: TrabajadorConTarifas[];
  puedeEditarTarifa: boolean;
  inicial?: ValoresMOD;
  textoBoton: string;
  ocultarTarifa?: boolean;
}) {
  const [v, setV] = useState<ValoresMOD>({ fecha: hoyBogota(), trabajadorId: trabajadores.length === 1 ? trabajadores[0].id : undefined, ...inicial });
  const trabajador = trabajadores.find((t) => t.id === v.trabajadorId);
  const vigente = tarifaEnFecha(trabajador, v.fecha ?? "");
  const tarifa = puedeEditarTarifa && v.tarifa ? v.tarifa : vigente || v.tarifa || "";
  const cambiar = (k: keyof ValoresMOD) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  let costo: string | null = null;
  try {
    if (v.horas && tarifa) costo = formatearPesos(d(v.horas.replace(",", ".")).times(d(tarifa.replace(",", "."))));
  } catch {
    costo = null;
  }

  return (
    <FormularioAccion accion={accion} reiniciar={!inicial.id} alExito={() => !inicial.id && setV({ fecha: v.fecha, trabajadorId: v.trabajadorId })} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {inicial.id && <input type="hidden" name="id" value={inicial.id} />}
      <Campo etiqueta="Trabajador">
        <Selector name="trabajadorId" value={v.trabajadorId ?? ""} onChange={cambiar("trabajadorId")}>
          {trabajadores.length > 1 && <option value="">— Por cargo —</option>}
          {trabajadores.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} ({t.cargo})
            </option>
          ))}
        </Selector>
      </Campo>
      {!v.trabajadorId && (
        <Campo etiqueta="Cargo">
          <Entrada name="cargo" value={v.cargo ?? ""} onChange={cambiar("cargo")} placeholder="Auxiliar, ensamblador…" />
        </Campo>
      )}
      <Campo etiqueta="Actividad realizada" className="lg:col-span-2">
        <Entrada name="actividad" required value={v.actividad ?? ""} onChange={cambiar("actividad")} />
      </Campo>
      <Campo etiqueta="Fecha">
        <Entrada type="date" name="fecha" required value={v.fecha ?? ""} onChange={cambiar("fecha")} />
      </Campo>
      <Campo etiqueta="Horas">
        <Entrada name="horas" inputMode="decimal" required value={v.horas ?? ""} onChange={cambiar("horas")} />
      </Campo>
      {!ocultarTarifa && (
        <Campo etiqueta="Tarifa por hora" ayuda={puedeEditarTarifa ? "Prellenada con la vigente" : "Tarifa vigente"}>
          <Entrada
            name="tarifa"
            inputMode="decimal"
            value={puedeEditarTarifa ? v.tarifa ?? vigente : vigente}
            readOnly={!puedeEditarTarifa}
            onChange={cambiar("tarifa")}
          />
        </Campo>
      )}
      <div className="flex items-end gap-3 text-sm">
        {!ocultarTarifa && costo && <span>Costo: <strong>{costo}</strong></span>}
        <Boton>{textoBoton}</Boton>
      </div>
    </FormularioAccion>
  );
}
